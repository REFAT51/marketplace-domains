"""Advanced AI Domain Marketplace - FastAPI Backend"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt as pyjwt
import secrets
import asyncio
import re
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest
)
from emergentintegrations.llm.chat import LlmChat, UserMessage

# ============== Config ==============
JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Domain Marketplace API")
api = APIRouter(prefix="/api")

# ============== Currency rates (mocked, base USD) ==============
CURRENCY_RATES = {"USD": 1.0, "EUR": 0.92, "EGP": 47.0, "USDT": 1.0, "BTC": 0.0000156}
CURRENCY_SYMBOLS = {"USD": "$", "EUR": "€", "EGP": "EGP", "USDT": "USDT", "BTC": "₿"}

SUBSCRIPTION_PLANS = {
    "free": {"name": "Free", "price_usd": 0.0, "max_listings": 5, "featured_credits": 0},
    "pro": {"name": "Pro", "price_usd": 29.0, "max_listings": 9999, "featured_credits": 10},
}
COMMISSION_RATE = 0.10  # 10%
FEATURED_LISTING_FEE_USD = 9.99

# ============== Models ==============
class RegisterReq(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "buyer"  # buyer | seller

class LoginReq(BaseModel):
    email: EmailStr
    password: str

class DomainCreate(BaseModel):
    name: str
    price_usd: float
    description: Optional[str] = ""
    category: Optional[str] = "general"
    tld: Optional[str] = None

class DomainUpdate(BaseModel):
    price_usd: Optional[float] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None

class OfferReq(BaseModel):
    domain_id: str
    amount_usd: float
    message: Optional[str] = ""

class CheckoutReq(BaseModel):
    kind: str  # "domain" | "subscription" | "featured" | "wallet_deposit"
    domain_id: Optional[str] = None
    plan: Optional[str] = None  # for subscription
    amount_usd: Optional[float] = None  # for wallet deposit
    origin_url: str

class WalletWithdrawReq(BaseModel):
    amount_usd: float
    method: str = "bank"

class AIValuationReq(BaseModel):
    domain: str

class AIBrandReq(BaseModel):
    keywords: str
    count: int = 8

class GoDaddyCheckReq(BaseModel):
    domain: str

class KYCSubmitReq(BaseModel):
    full_name: str
    country: str
    id_number: str
    document_type: str = "passport"

class AdminApprovalReq(BaseModel):
    domain_id: str
    action: str  # "approve" | "reject"

class CryptoCheckoutReq(BaseModel):
    kind: str
    domain_id: Optional[str] = None
    amount_usd: Optional[float] = None
    currency: str = "USDT"

# ============== Helpers ==============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")

def public_user(u: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u.get("role", "buyer"),
        "subscription": u.get("subscription", "free"),
        "wallet_balance_usd": u.get("wallet_balance_usd", 0.0),
        "kyc_status": u.get("kyc_status", "none"),
        "created_at": u.get("created_at"),
    }

async def get_current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("password_hash", None)
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user=Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============== Heuristic Domain Valuation ==============
TRENDING_KEYWORDS = ["ai", "crypto", "nft", "web3", "fintech", "pay", "bank", "chat", "gpt",
                    "cloud", "data", "meta", "vr", "bio", "health", "eco", "green", "smart",
                    "trade", "stake", "dao", "defi", "token", "swap", "yield"]
PREMIUM_TLDS = {".com": 10, ".ai": 9, ".io": 8, ".co": 7, ".net": 6, ".app": 7, ".xyz": 5}

def heuristic_valuation(domain: str) -> Dict[str, Any]:
    d = domain.lower().strip()
    if "." not in d:
        d = d + ".com"
    name, _, ext = d.rpartition(".")
    ext = "." + ext
    length = len(name)

    length_score = 10 if length < 6 else (8 if length < 9 else (5 if length < 13 else 3))
    keyword_hits = [k for k in TRENDING_KEYWORDS if k in name]
    keyword_score = min(10, 4 + 2 * len(keyword_hits))
    tld_score = PREMIUM_TLDS.get(ext, 4)
    brandable_score = 8 if re.match(r"^[a-z]{4,10}$", name) else 5
    pron_score = 7 if re.search(r"[aeiou]", name) and not re.search(r"[bcdfghjklmnpqrstvwxyz]{4,}", name) else 4
    total = length_score + keyword_score + tld_score + brandable_score + pron_score  # max 45
    score_100 = round(total / 45 * 100)

    base_price = 50 * length_score + 200 * keyword_score + 100 * tld_score + 60 * brandable_score
    if "ai" in keyword_hits:
        base_price *= 1.6
    if "crypto" in keyword_hits or "defi" in keyword_hits:
        base_price *= 1.4

    demand = "High" if total > 32 else ("Medium" if total > 22 else "Low")
    return {
        "domain": d,
        "score": score_100,
        "estimated_price_usd": round(base_price, 2),
        "demand": demand,
        "length": length,
        "tld": ext,
        "keywords_matched": keyword_hits,
        "is_brandable": brandable_score >= 7,
    }

# ============== Auth Endpoints ==============
@api.post("/auth/register")
async def register(body: RegisterReq, response: Response):
    email = body.email.lower().strip()
    if body.role not in ("buyer", "seller"):
        raise HTTPException(400, "Invalid role")
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name.strip(),
        "role": body.role,
        "subscription": "free",
        "wallet_balance_usd": 0.0,
        "kyc_status": "none",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    access = create_access_token(user_id, email, body.role)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    return {"user": public_user(doc), "access_token": access}

@api.post("/auth/login")
async def login(body: LoginReq, request: Request, response: Response):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    # brute force check
    attempts = await db.login_attempts.find_one({"identifier": identifier})
    if attempts and attempts.get("count", 0) >= 5:
        last = attempts.get("last_at")
        if last:
            last_dt = datetime.fromisoformat(last)
            if datetime.now(timezone.utc) - last_dt < timedelta(minutes=15):
                raise HTTPException(429, "Too many failed attempts. Try again in 15 minutes.")
            else:
                await db.login_attempts.delete_one({"identifier": identifier})
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"last_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        raise HTTPException(401, "Invalid credentials")
    await db.login_attempts.delete_one({"identifier": identifier})
    access = create_access_token(user["id"], email, user.get("role", "buyer"))
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"user": public_user(user), "access_token": access}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return public_user(user)

# ============== Currency ==============
@api.get("/currency/rates")
async def get_rates():
    return {"base": "USD", "rates": CURRENCY_RATES, "symbols": CURRENCY_SYMBOLS}

@api.get("/currency/detect")
async def detect_currency(request: Request):
    # mock detection - in production use IP geolocation
    return {"currency": "USD"}

# ============== Domains ==============
@api.get("/domains")
async def list_domains(
    q: Optional[str] = None,
    tld: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    category: Optional[str] = None,
    featured: Optional[bool] = None,
    sort: Optional[str] = "newest",
    limit: int = 50,
):
    query: Dict[str, Any] = {"status": {"$in": ["active", "approved"]}}
    if q:
        query["name"] = {"$regex": re.escape(q.lower()), "$options": "i"}
    if tld:
        query["tld"] = tld if tld.startswith(".") else f".{tld}"
    if min_price is not None:
        query.setdefault("price_usd", {})["$gte"] = min_price
    if max_price is not None:
        query.setdefault("price_usd", {})["$lte"] = max_price
    if category and category != "all":
        query["category"] = category
    if featured:
        query["featured"] = True
    sort_map = {
        "newest": [("created_at", -1)],
        "price_asc": [("price_usd", 1)],
        "price_desc": [("price_usd", -1)],
        "score_desc": [("ai_score", -1)],
    }
    cursor = db.domains.find(query, {"_id": 0}).sort(sort_map.get(sort, sort_map["newest"])).limit(limit)
    return await cursor.to_list(limit)

@api.get("/domains/featured")
async def featured_domains(limit: int = 8):
    cursor = db.domains.find(
        {"status": {"$in": ["active", "approved"]}, "featured": True},
        {"_id": 0},
    ).sort([("created_at", -1)]).limit(limit)
    items = await cursor.to_list(limit)
    if len(items) < limit:
        more = await db.domains.find(
            {"status": {"$in": ["active", "approved"]}, "featured": {"$ne": True}},
            {"_id": 0},
        ).sort([("ai_score", -1)]).limit(limit - len(items)).to_list(limit)
        items.extend(more)
    return items

@api.get("/domains/{domain_id}")
async def get_domain(domain_id: str):
    d = await db.domains.find_one({"id": domain_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Domain not found")
    return d

@api.post("/domains")
async def create_domain(body: DomainCreate, user=Depends(get_current_user)):
    if user.get("role") not in ("seller", "admin"):
        raise HTTPException(403, "Only sellers can list domains")
    # subscription limit
    sub = user.get("subscription", "free")
    plan = SUBSCRIPTION_PLANS.get(sub, SUBSCRIPTION_PLANS["free"])
    listings_count = await db.domains.count_documents({"seller_id": user["id"], "status": {"$ne": "sold"}})
    if listings_count >= plan["max_listings"]:
        raise HTTPException(403, f"Listing limit reached for {plan['name']} plan. Upgrade to Pro.")

    name = body.name.lower().strip()
    if "." not in name:
        raise HTTPException(400, "Domain must include TLD (e.g., example.com)")
    tld = "." + name.rsplit(".", 1)[1]
    if await db.domains.find_one({"name": name}):
        raise HTTPException(400, "Domain already listed")

    val = heuristic_valuation(name)
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "tld": tld,
        "price_usd": float(body.price_usd),
        "description": body.description or "",
        "category": body.category or "general",
        "seller_id": user["id"],
        "seller_name": user.get("name", ""),
        "status": "active",
        "featured": False,
        "ai_score": val["score"],
        "ai_estimate_usd": val["estimated_price_usd"],
        "ai_demand": val["demand"],
        "views": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.domains.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.put("/domains/{domain_id}")
async def update_domain(domain_id: str, body: DomainUpdate, user=Depends(get_current_user)):
    d = await db.domains.find_one({"id": domain_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Not found")
    if d["seller_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.domains.update_one({"id": domain_id}, {"$set": updates})
    d2 = await db.domains.find_one({"id": domain_id}, {"_id": 0})
    return d2

@api.delete("/domains/{domain_id}")
async def delete_domain(domain_id: str, user=Depends(get_current_user)):
    d = await db.domains.find_one({"id": domain_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Not found")
    if d["seller_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    await db.domains.delete_one({"id": domain_id})
    return {"ok": True}

@api.get("/domains/mine/list")
async def my_domains(user=Depends(get_current_user)):
    items = await db.domains.find({"seller_id": user["id"]}, {"_id": 0}).sort([("created_at", -1)]).to_list(500)
    return items

# ============== Offers ==============
@api.post("/offers")
async def make_offer(body: OfferReq, user=Depends(get_current_user)):
    d = await db.domains.find_one({"id": body.domain_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Domain not found")
    doc = {
        "id": str(uuid.uuid4()),
        "domain_id": body.domain_id,
        "domain_name": d["name"],
        "buyer_id": user["id"],
        "buyer_name": user.get("name", ""),
        "seller_id": d["seller_id"],
        "amount_usd": float(body.amount_usd),
        "message": body.message or "",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.offers.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.get("/offers/mine")
async def my_offers(user=Depends(get_current_user)):
    received = await db.offers.find({"seller_id": user["id"]}, {"_id": 0}).sort([("created_at", -1)]).to_list(200)
    sent = await db.offers.find({"buyer_id": user["id"]}, {"_id": 0}).sort([("created_at", -1)]).to_list(200)
    return {"received": received, "sent": sent}

# ============== AI Endpoints ==============
async def call_llm(system: str, prompt: str, session: str) -> str:
    if not EMERGENT_LLM_KEY:
        return ""
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session, system_message=system).with_model("openai", "gpt-5.2")
        resp = await chat.send_message(UserMessage(text=prompt))
        return resp if isinstance(resp, str) else str(resp)
    except Exception as e:
        logger.error(f"LLM error: {e}")
        return ""

@api.post("/ai/valuation")
async def ai_valuation(body: AIValuationReq):
    base = heuristic_valuation(body.domain)
    sys = ("You are an expert domain investor. Given a domain, provide a brief 2-3 sentence "
           "professional analysis of its market value, brandability, and target industry. "
           "Be concise, factual, and avoid filler.")
    prompt = f"Analyze the domain: {body.domain}. Heuristic score: {base['score']}/100, est ${base['estimated_price_usd']}."
    ai_analysis = await call_llm(sys, prompt, f"val-{uuid.uuid4()}")
    return {**base, "ai_analysis": ai_analysis or "AI analysis unavailable. Heuristic valuation provided."}

@api.post("/ai/brandable")
async def ai_brandable(body: AIBrandReq):
    sys = ("You generate brandable, premium domain names. Output ONLY a comma-separated list of "
           "domain names with TLD (.com, .ai, .io). No numbering, no explanations. 8 domains.")
    prompt = f"Generate {body.count} brandable startup-style domains for keywords: {body.keywords}"
    out = await call_llm(sys, prompt, f"brand-{uuid.uuid4()}")
    suggestions: List[Dict[str, Any]] = []
    if out:
        for raw in re.split(r"[,\n]", out):
            n = raw.strip().lower().strip(".").strip()
            n = re.sub(r"^[\d\.\-\)\s]+", "", n)
            if "." in n and 3 < len(n) < 30 and re.match(r"^[a-z0-9\-]+\.[a-z]+$", n):
                suggestions.append(heuristic_valuation(n))
    if not suggestions:
        # fallback
        kws = [k.strip().lower() for k in body.keywords.split(",") if k.strip()][:3] or ["tech"]
        for k in kws:
            for suffix in ["hub", "labs", "ai", "pro", "io"]:
                suggestions.append(heuristic_valuation(f"{k}{suffix}.com"))
    return {"suggestions": suggestions[: body.count]}

@api.get("/ai/trends")
async def ai_trends():
    trends = [
        {"niche": "AI / LLM", "keywords": ["ai", "gpt", "llm", "agent"], "growth": "+187%", "score": 95},
        {"niche": "Web3 / DeFi", "keywords": ["dao", "defi", "stake", "swap"], "growth": "+74%", "score": 82},
        {"niche": "Fintech", "keywords": ["pay", "bank", "card", "loan"], "growth": "+58%", "score": 79},
        {"niche": "Health / Bio", "keywords": ["bio", "health", "med", "care"], "growth": "+41%", "score": 71},
        {"niche": "Climate / Eco", "keywords": ["eco", "green", "climate", "carbon"], "growth": "+33%", "score": 68},
    ]
    return {"trends": trends}

# ============== GoDaddy (mocked) ==============
@api.post("/godaddy/check")
async def godaddy_check(body: GoDaddyCheckReq):
    # MOCKED endpoint - returns plausible data, real GoDaddy requires API keys
    d = body.domain.lower().strip()
    if "." not in d:
        d = d + ".com"
    val = heuristic_valuation(d)
    available = (hash(d) % 7) != 0
    return {
        "domain": d,
        "available": available,
        "price_usd": round(12 + (hash(d) % 50), 2) if available else None,
        "currency": "USD",
        "definitive": True,
        "_mocked": True,
        "ai_estimate_usd": val["estimated_price_usd"],
    }

@api.get("/godaddy/suggest")
async def godaddy_suggest(q: str, count: int = 6):
    base = q.lower().strip()
    suffixes = ["app", "hub", "labs", "io", "ai", "pro", "get", "go"]
    suggestions = []
    for s in suffixes[:count]:
        n = f"{s}{base}.com" if hash(s) % 2 else f"{base}{s}.com"
        v = heuristic_valuation(n)
        suggestions.append({**v, "available": True, "_mocked": True})
    return {"suggestions": suggestions[:count]}

# ============== Stripe Payments ==============
@api.post("/payments/checkout")
async def create_checkout(body: CheckoutReq, request: Request, user=Depends(get_current_user)):
    if not STRIPE_API_KEY:
        raise HTTPException(500, "Stripe not configured")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/checkout/cancel"

    metadata: Dict[str, str] = {"user_id": user["id"], "kind": body.kind}
    amount = 0.0

    if body.kind == "domain":
        if not body.domain_id:
            raise HTTPException(400, "domain_id required")
        d = await db.domains.find_one({"id": body.domain_id}, {"_id": 0})
        if not d:
            raise HTTPException(404, "Domain not found")
        if d.get("status") == "sold":
            raise HTTPException(400, "Already sold")
        amount = float(d["price_usd"])
        metadata["domain_id"] = body.domain_id
    elif body.kind == "subscription":
        if body.plan not in SUBSCRIPTION_PLANS:
            raise HTTPException(400, "Invalid plan")
        amount = SUBSCRIPTION_PLANS[body.plan]["price_usd"]
        if amount <= 0:
            raise HTTPException(400, "Plan is free")
        metadata["plan"] = body.plan
    elif body.kind == "featured":
        if not body.domain_id:
            raise HTTPException(400, "domain_id required")
        amount = FEATURED_LISTING_FEE_USD
        metadata["domain_id"] = body.domain_id
    elif body.kind == "wallet_deposit":
        if not body.amount_usd or body.amount_usd < 5:
            raise HTTPException(400, "Minimum deposit is $5")
        amount = float(body.amount_usd)
    else:
        raise HTTPException(400, "Invalid checkout kind")

    req = CheckoutSessionRequest(
        amount=float(amount), currency="usd",
        success_url=success_url, cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await sc.create_checkout_session(req)
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user["id"],
        "amount_usd": amount,
        "currency": "usd",
        "kind": body.kind,
        "metadata": metadata,
        "payment_status": "initiated",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id}

@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaction not found")
    if tx["payment_status"] == "paid":
        return {"payment_status": "paid", "status": "complete", "kind": tx["kind"]}
    host_url = str(request.base_url).rstrip("/")
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe")
    s = await sc.get_checkout_status(session_id)
    if s.payment_status == "paid" and tx["payment_status"] != "paid":
        await _process_paid_transaction(session_id)
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"payment_status": s.payment_status, "status": s.status,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"payment_status": s.payment_status, "status": s.status, "kind": tx["kind"]}

async def _process_paid_transaction(session_id: str):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx or tx.get("processed"):
        return
    md = tx.get("metadata", {})
    kind = tx["kind"]
    user_id = tx["user_id"]
    amount = tx["amount_usd"]
    now = datetime.now(timezone.utc).isoformat()

    if kind == "domain":
        domain_id = md.get("domain_id")
        d = await db.domains.find_one({"id": domain_id}, {"_id": 0})
        if d:
            commission = round(amount * COMMISSION_RATE, 2)
            seller_amount = round(amount - commission, 2)
            await db.domains.update_one({"id": domain_id}, {"$set": {"status": "in_escrow",
                                                                       "buyer_id": user_id,
                                                                       "sold_at": now,
                                                                       "sold_price_usd": amount}})
            await db.escrow.insert_one({
                "id": str(uuid.uuid4()),
                "domain_id": domain_id,
                "domain_name": d["name"],
                "buyer_id": user_id, "seller_id": d["seller_id"],
                "amount_usd": amount, "commission_usd": commission,
                "seller_amount_usd": seller_amount,
                "status": "pending_transfer", "created_at": now,
            })
            await db.transactions.insert_one({
                "id": str(uuid.uuid4()), "user_id": user_id,
                "type": "purchase", "amount_usd": -amount,
                "description": f"Purchase: {d['name']}", "created_at": now,
            })
    elif kind == "subscription":
        plan = md.get("plan", "pro")
        await db.users.update_one({"id": user_id}, {"$set": {"subscription": plan,
                                                              "subscription_at": now}})
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()), "user_id": user_id, "type": "subscription",
            "amount_usd": -amount, "description": f"{plan.title()} subscription", "created_at": now,
        })
    elif kind == "featured":
        domain_id = md.get("domain_id")
        await db.domains.update_one({"id": domain_id}, {"$set": {"featured": True,
                                                                  "featured_at": now}})
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()), "user_id": user_id, "type": "featured",
            "amount_usd": -amount, "description": "Featured listing boost", "created_at": now,
        })
    elif kind == "wallet_deposit":
        await db.users.update_one({"id": user_id}, {"$inc": {"wallet_balance_usd": amount}})
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()), "user_id": user_id, "type": "deposit",
            "amount_usd": amount, "description": "Wallet deposit (Stripe)", "created_at": now,
        })
    await db.payment_transactions.update_one({"session_id": session_id},
                                              {"$set": {"processed": True, "processed_at": now}})

@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    try:
        evt = await sc.handle_webhook(body, sig)
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return JSONResponse({"ok": False}, status_code=400)
    if evt.payment_status == "paid":
        await _process_paid_transaction(evt.session_id)
    return {"ok": True}

# ============== Crypto (mocked Coinbase Commerce) ==============
@api.post("/crypto/checkout")
async def crypto_checkout(body: CryptoCheckoutReq, user=Depends(get_current_user)):
    """MOCKED Coinbase Commerce. Real integration needs CB_COMMERCE_API_KEY.
    Creates a pending transaction that must be manually confirmed."""
    amount = 0.0
    metadata: Dict[str, str] = {"user_id": user["id"], "kind": body.kind, "currency": body.currency}
    if body.kind == "domain":
        if not body.domain_id:
            raise HTTPException(400, "domain_id required")
        d = await db.domains.find_one({"id": body.domain_id}, {"_id": 0})
        if not d:
            raise HTTPException(404, "Domain not found")
        amount = float(d["price_usd"])
        metadata["domain_id"] = body.domain_id
    elif body.kind == "wallet_deposit":
        if not body.amount_usd or body.amount_usd < 5:
            raise HTTPException(400, "Minimum deposit is $5")
        amount = float(body.amount_usd)
    else:
        raise HTTPException(400, "Invalid kind")

    # mock crypto address
    crypto_address = f"bc1q{uuid.uuid4().hex[:32]}" if body.currency == "BTC" else f"0x{uuid.uuid4().hex[:40]}"
    rate = CURRENCY_RATES.get(body.currency, 1.0)
    crypto_amount = round(amount * rate, 8)
    charge_id = f"cb_mock_{uuid.uuid4().hex[:16]}"
    await db.crypto_charges.insert_one({
        "id": str(uuid.uuid4()),
        "charge_id": charge_id,
        "user_id": user["id"],
        "amount_usd": amount,
        "crypto_amount": crypto_amount,
        "currency": body.currency,
        "address": crypto_address,
        "kind": body.kind,
        "metadata": metadata,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "charge_id": charge_id,
        "address": crypto_address,
        "amount_usd": amount,
        "crypto_amount": crypto_amount,
        "currency": body.currency,
        "status": "pending",
        "_mocked": True,
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
    }

@api.post("/crypto/confirm/{charge_id}")
async def crypto_confirm(charge_id: str, user=Depends(get_current_user)):
    """MOCKED confirmation - in production this is via Coinbase webhook."""
    ch = await db.crypto_charges.find_one({"charge_id": charge_id}, {"_id": 0})
    if not ch:
        raise HTTPException(404, "Charge not found")
    if ch["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    if ch["status"] == "completed":
        return {"status": "completed"}
    now = datetime.now(timezone.utc).isoformat()
    await db.crypto_charges.update_one({"charge_id": charge_id},
                                        {"$set": {"status": "completed", "completed_at": now}})
    # mirror logic from _process_paid_transaction
    md = ch["metadata"]
    kind = ch["kind"]
    amount = ch["amount_usd"]
    user_id = ch["user_id"]
    if kind == "domain":
        domain_id = md["domain_id"]
        d = await db.domains.find_one({"id": domain_id}, {"_id": 0})
        if d:
            commission = round(amount * COMMISSION_RATE, 2)
            seller_amount = round(amount - commission, 2)
            await db.domains.update_one({"id": domain_id}, {"$set": {"status": "in_escrow",
                                                                       "buyer_id": user_id,
                                                                       "sold_at": now,
                                                                       "sold_price_usd": amount}})
            await db.escrow.insert_one({
                "id": str(uuid.uuid4()), "domain_id": domain_id, "domain_name": d["name"],
                "buyer_id": user_id, "seller_id": d["seller_id"],
                "amount_usd": amount, "commission_usd": commission,
                "seller_amount_usd": seller_amount, "status": "pending_transfer",
                "payment_method": "crypto", "currency": ch["currency"], "created_at": now,
            })
    elif kind == "wallet_deposit":
        await db.users.update_one({"id": user_id}, {"$inc": {"wallet_balance_usd": amount}})
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()), "user_id": user_id, "type": "deposit",
            "amount_usd": amount, "description": f"Wallet deposit ({ch['currency']})", "created_at": now,
        })
    return {"status": "completed"}

# ============== Wallet ==============
@api.get("/wallet")
async def wallet(user=Depends(get_current_user)):
    txs = await db.transactions.find({"user_id": user["id"]}, {"_id": 0}).sort([("created_at", -1)]).limit(100).to_list(100)
    return {
        "balance_usd": user.get("wallet_balance_usd", 0.0),
        "transactions": txs,
    }

@api.post("/wallet/withdraw")
async def wallet_withdraw(body: WalletWithdrawReq, user=Depends(get_current_user)):
    if body.amount_usd <= 0:
        raise HTTPException(400, "Invalid amount")
    if user.get("wallet_balance_usd", 0.0) < body.amount_usd:
        raise HTTPException(400, "Insufficient balance")
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance_usd": -body.amount_usd}})
    now = datetime.now(timezone.utc).isoformat()
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "type": "withdraw",
        "amount_usd": -body.amount_usd, "description": f"Withdrawal via {body.method}", "created_at": now,
    })
    return {"ok": True}

# ============== Escrow ==============
@api.get("/escrow/mine")
async def my_escrow(user=Depends(get_current_user)):
    items = await db.escrow.find(
        {"$or": [{"buyer_id": user["id"]}, {"seller_id": user["id"]}]},
        {"_id": 0},
    ).sort([("created_at", -1)]).to_list(200)
    return items

@api.post("/escrow/{escrow_id}/confirm-transfer")
async def confirm_transfer(escrow_id: str, user=Depends(get_current_user)):
    e = await db.escrow.find_one({"id": escrow_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Not found")
    if e["buyer_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "Only buyer can confirm transfer")
    if e["status"] == "completed":
        return e
    now = datetime.now(timezone.utc).isoformat()
    await db.escrow.update_one({"id": escrow_id}, {"$set": {"status": "completed", "completed_at": now}})
    await db.domains.update_one({"id": e["domain_id"]}, {"$set": {"status": "sold"}})
    # credit seller
    await db.users.update_one({"id": e["seller_id"]}, {"$inc": {"wallet_balance_usd": e["seller_amount_usd"]}})
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()), "user_id": e["seller_id"], "type": "sale",
        "amount_usd": e["seller_amount_usd"],
        "description": f"Sale: {e['domain_name']} (after 10% commission)", "created_at": now,
    })
    # commission
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()), "user_id": "platform", "type": "commission",
        "amount_usd": e["commission_usd"], "description": f"Commission: {e['domain_name']}",
        "created_at": now,
    })
    return await db.escrow.find_one({"id": escrow_id}, {"_id": 0})

# ============== KYC ==============
@api.post("/kyc/submit")
async def kyc_submit(body: KYCSubmitReq, user=Depends(get_current_user)):
    await db.kyc.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"],
        "full_name": body.full_name, "country": body.country,
        "id_number": body.id_number, "document_type": body.document_type,
        "status": "pending", "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.users.update_one({"id": user["id"]}, {"$set": {"kyc_status": "pending"}})
    return {"status": "pending"}

@api.get("/kyc/status")
async def kyc_status(user=Depends(get_current_user)):
    return {"status": user.get("kyc_status", "none")}

# ============== Admin ==============
@api.get("/admin/stats")
async def admin_stats(user=Depends(require_admin)):
    total_users = await db.users.count_documents({})
    total_domains = await db.domains.count_documents({})
    sold_domains = await db.domains.count_documents({"status": "sold"})
    in_escrow = await db.escrow.count_documents({"status": "pending_transfer"})
    pending_kyc = await db.kyc.count_documents({"status": "pending"})

    # revenue
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": "$kind", "total": {"$sum": "$amount_usd"}, "count": {"$sum": 1}}},
    ]
    rev_by_kind = await db.payment_transactions.aggregate(pipeline).to_list(100)
    total_revenue = sum(r["total"] for r in rev_by_kind)
    commission_pipeline = [
        {"$match": {"type": "commission"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}},
    ]
    comm = await db.transactions.aggregate(commission_pipeline).to_list(1)
    total_commission = (comm[0]["total"] if comm else 0.0)

    # last 7 days revenue
    daily = []
    for i in range(6, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        cursor = db.payment_transactions.find({
            "payment_status": "paid",
            "created_at": {"$regex": f"^{day}"}
        }, {"_id": 0, "amount_usd": 1})
        items = await cursor.to_list(1000)
        daily.append({"date": day, "revenue": sum(it.get("amount_usd", 0) for it in items)})

    return {
        "users": total_users,
        "domains": total_domains,
        "sold": sold_domains,
        "in_escrow": in_escrow,
        "pending_kyc": pending_kyc,
        "total_revenue_usd": round(total_revenue, 2),
        "total_commission_usd": round(total_commission, 2),
        "revenue_by_kind": rev_by_kind,
        "daily_revenue": daily,
    }

@api.get("/admin/users")
async def admin_users(user=Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort([("created_at", -1)]).limit(500).to_list(500)
    return users

@api.get("/admin/domains/pending")
async def admin_pending_domains(user=Depends(require_admin)):
    items = await db.domains.find({"status": "active"}, {"_id": 0}).sort([("created_at", -1)]).limit(200).to_list(200)
    return items

@api.post("/admin/domains/approve")
async def admin_approve(body: AdminApprovalReq, user=Depends(require_admin)):
    if body.action == "approve":
        await db.domains.update_one({"id": body.domain_id}, {"$set": {"status": "approved"}})
    elif body.action == "reject":
        await db.domains.update_one({"id": body.domain_id}, {"$set": {"status": "rejected"}})
    else:
        raise HTTPException(400, "Invalid action")
    return {"ok": True}

@api.get("/admin/kyc")
async def admin_kyc(user=Depends(require_admin)):
    items = await db.kyc.find({}, {"_id": 0}).sort([("created_at", -1)]).to_list(200)
    return items

@api.post("/admin/kyc/{kyc_id}/approve")
async def admin_kyc_approve(kyc_id: str, user=Depends(require_admin)):
    k = await db.kyc.find_one({"id": kyc_id}, {"_id": 0})
    if not k:
        raise HTTPException(404, "Not found")
    await db.kyc.update_one({"id": kyc_id}, {"$set": {"status": "approved"}})
    await db.users.update_one({"id": k["user_id"]}, {"$set": {"kyc_status": "approved"}})
    return {"ok": True}

# ============== Pricing ==============
@api.get("/pricing/plans")
async def pricing_plans():
    return {"plans": SUBSCRIPTION_PLANS, "commission_rate": COMMISSION_RATE,
            "featured_fee_usd": FEATURED_LISTING_FEE_USD}

# ============== Health ==============
@api.get("/")
async def health():
    return {"status": "ok", "service": "AI Domain Marketplace API"}

# ============== Startup ==============
async def seed_admin():
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin", "role": "admin",
            "subscription": "pro", "wallet_balance_usd": 0.0,
            "kyc_status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin seeded: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                   {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info(f"Admin password updated: {admin_email}")

async def seed_demo_domains():
    if await db.domains.count_documents({}) > 0:
        return
    seller_id = str(uuid.uuid4())
    # demo seller
    await db.users.insert_one({
        "id": seller_id, "email": "demo.seller@domainai.com",
        "password_hash": hash_password("Seller@12345"),
        "name": "Demo Seller", "role": "seller",
        "subscription": "pro", "wallet_balance_usd": 0.0, "kyc_status": "approved",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    samples = [
        ("aigentlabs.com", 8500, "AI", "Premium AI brand for agent / LLM startups", True),
        ("cryptohaven.com", 12000, "crypto", "Premium crypto exchange / wallet brand", True),
        ("paystack.ai", 6900, "fintech", "AI-powered payments brand on .ai TLD", True),
        ("zenflow.io", 3200, "saas", "Productivity / workflow SaaS brand", False),
        ("nexpay.com", 9800, "fintech", "Next-generation payment platform", True),
        ("biolabs.ai", 7400, "health", "Biotech / pharma research brand", False),
        ("ecogrid.io", 2800, "climate", "Smart green energy grid brand", False),
        ("vaultai.com", 11500, "AI", "Secure AI vault / data brand", True),
        ("stakedao.io", 4200, "crypto", "DeFi staking platform brand", False),
        ("gptforge.ai", 5600, "AI", "LLM developer tooling brand", False),
        ("cloudtide.com", 3900, "saas", "Cloud infrastructure brand", False),
        ("metabank.io", 8800, "fintech", "Modern digital banking brand", True),
    ]
    docs = []
    for name, price, cat, desc, feat in samples:
        v = heuristic_valuation(name)
        docs.append({
            "id": str(uuid.uuid4()), "name": name, "tld": "." + name.rsplit(".", 1)[1],
            "price_usd": float(price), "description": desc, "category": cat,
            "seller_id": seller_id, "seller_name": "Demo Seller",
            "status": "approved", "featured": feat,
            "ai_score": v["score"], "ai_estimate_usd": v["estimated_price_usd"],
            "ai_demand": v["demand"], "views": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    if docs:
        await db.domains.insert_many(docs)
    logger.info(f"Seeded {len(docs)} demo domains")

@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.domains.create_index("name", unique=True)
        await db.login_attempts.create_index("identifier")
    except Exception as e:
        logger.warning(f"Index error: {e}")
    await seed_admin()
    await seed_demo_domains()

@app.on_event("shutdown")
async def shutdown():
    client.close()

# Mount router
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
