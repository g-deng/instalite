import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Signup from "./pages/Signup";
// import React from "react";
import Friends from "./pages/Friends";
import ChatInterface from "./pages/ChatInterface";
import ChatMode from "./pages/ChatMode";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path='/signup' element={<Signup />} />
        <Route path='/:username/home' element={<Home />} />
        <Route path='/:username/friends' element={<Friends />} />
        <Route path="/:username/chat" element={<ChatInterface />} />
        <Route path="/:username/chatMode" element={<ChatMode />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
