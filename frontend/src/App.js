import { BrowserRouter, Routes, Route } from "react-router-dom";
import Admin from "./pages/Admin";

function Home() {
  return <h1>Welcome to Domain Marketplace 🚀</h1>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />  {/* مهم جدًا */}
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
