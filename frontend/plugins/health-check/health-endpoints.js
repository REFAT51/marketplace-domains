// health-endpoints.js
// Improved & production-ready health endpoints

const os = require("os");

const SERVER_START_TIME = Date.now();
const CPU_COUNT = os.cpus().length;

// ====================================================================
// Setup Function
// ====================================================================

function setupHealthEndpoints(devServer, healthPlugin) {
  if (!devServer || !devServer.app) {
    console.warn("[Health Check] Dev server not available, skipping...");
    return;
  }

  if (!healthPlugin) {
    console.warn("[Health Check] Health plugin not provided, skipping...");
    return;
  }

  const app = devServer.app;

  // ====================================================================
  // GET /health - Detailed health status
  // ====================================================================
  app.get("/health", async (req, res) => {
    try {
      const webpackStatus = healthPlugin.getStatus?.() || {};
      const uptime = Date.now() - SERVER_START_TIME;
      const memUsage = process.memoryUsage();

      const {
        isHealthy = false,
        state = "unknown",
        hasCompiled = false,
        errorCount = 0,
        warningCount = 0,
        lastCompileTime = null,
        lastSuccessTime = null,
        compileDuration = null,
        totalCompiles = 0,
        firstCompileTime = null,
        errors = [],
        warnings = [],
      } = webpackStatus;

      res.json({
        status: isHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        uptime: {
          seconds: Math.floor(uptime / 1000),
          formatted: formatDuration(uptime),
        },
        webpack: {
          state,
          isHealthy,
          hasCompiled,
          errors: errorCount,
          warnings: warningCount,
          lastCompileTime: lastCompileTime
            ? new Date(lastCompileTime).toISOString()
            : null,
          lastSuccessTime: lastSuccessTime
            ? new Date(lastSuccessTime).toISOString()
            : null,
          compileDuration: compileDuration
            ? `${compileDuration}ms`
            : null,
          totalCompiles,
          firstCompileTime: firstCompileTime
            ? new Date(firstCompileTime).toISOString()
            : null,
        },
        server: {
          nodeVersion: process.version,
          platform: os.platform(),
          arch: os.arch(),
          cpus: CPU_COUNT,
          memory: {
            heapUsed: formatBytes(memUsage.heapUsed || 0),
            heapTotal: formatBytes(memUsage.heapTotal || 0),
            rss: formatBytes(memUsage.rss || 0),
            external: formatBytes(memUsage.external || 0),
          },
          systemMemory: {
            total: formatBytes(os.totalmem()),
            free: formatBytes(os.freemem()),
            used: formatBytes(os.totalmem() - os.freemem()),
          },
        },
        environment: process.env.NODE_ENV || "development",
      });
    } catch (err) {
      res.status(500).json({ error: "Health check failed" });
    }
  });

  // ====================================================================
  // GET /health/simple
  // ====================================================================
  app.get("/health/simple", (req, res) => {
    try {
      const { state = "unknown" } =
        healthPlugin.getSimpleStatus?.() || {};

      if (state === "success") return res.status(200).send("OK");
      if (state === "idle") return res.status(200).send("IDLE");
      if (state === "compiling")
        return res.status(503).send("COMPILING");

      return res.status(503).send("ERROR");
    } catch {
      return res.status(503).send("ERROR");
    }
  });

  // ====================================================================
  // GET /health/ready
  // ====================================================================
  app.get("/health/ready", (req, res) => {
    try {
      const { state = "unknown" } =
        healthPlugin.getSimpleStatus?.() || {};

      if (state === "success") {
        return res.status(200).json({
          ready: true,
          state,
        });
      }

      return res.status(503).json({
        ready: false,
        state,
        reason:
          state === "compiling"
            ? "Compilation in progress"
            : "Compilation failed",
      });
    } catch {
      return res.status(503).json({
        ready: false,
        state: "error",
      });
    }
  });

  // ====================================================================
  // GET /health/live
  // ====================================================================
  app.get("/health/live", (req, res) => {
    res.status(200).json({
      alive: true,
      timestamp: new Date().toISOString(),
    });
  });

  // ====================================================================
  // GET /health/errors
  // ====================================================================
  app.get("/health/errors", (req, res) => {
    try {
      const webpackStatus = healthPlugin.getStatus?.() || {};

      res.json({
        errorCount: webpackStatus.errorCount || 0,
        warningCount: webpackStatus.warningCount || 0,
        errors: webpackStatus.errors || [],
        warnings: webpackStatus.warnings || [],
        state: webpackStatus.state || "unknown",
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch errors" });
    }
  });

  // ====================================================================
  // GET /health/stats
  // ====================================================================
  app.get("/health/stats", (req, res) => {
    try {
      const webpackStatus = healthPlugin.getStatus?.() || {};
      const uptime = Date.now() - SERVER_START_TIME;

      const total = webpackStatus.totalCompiles || 0;

      res.json({
        totalCompiles: total,
        averageCompileTime:
          total > 0 ? `${Math.round(uptime / total)}ms` : null,
        lastCompileDuration: webpackStatus.compileDuration
          ? `${webpackStatus.compileDuration}ms`
          : null,
        firstCompileTime: webpackStatus.firstCompileTime
          ? new Date(webpackStatus.firstCompileTime).toISOString()
          : null,
        serverUptime: formatDuration(uptime),
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // ====================================================================
  // Logs (disabled in production)
  // ====================================================================
  if (process.env.NODE_ENV !== "production") {
    console.log("[Health Check] ✓ Endpoints ready:");
    console.log("  • /health");
    console.log("  • /health/simple");
    console.log("  • /health/ready");
    console.log("  • /health/live");
    console.log("  • /health/errors");
    console.log("  • /health/stats");
  }
}

// ====================================================================
// Helpers
// ====================================================================

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    Math.round((bytes / Math.pow(k, i)) * 100) / 100 +
    " " +
    sizes[i]
  );
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

module.exports = setupHealthEndpoints;
