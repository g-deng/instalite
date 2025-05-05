import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Signup from "./pages/Signup";
// import React from "react";
import Friends from "./pages/Friends";
import ChatInterface from "./pages/ChatInterface";
import ChatMode from "./pages/ChatMode";
import CreatePost from "./pages/CreatePost";
import Upload from "./pages/Upload";
import KafkaDemo from "./pages/KafkaDemo";
import { getSocket } from "./Socket";
import PhotoSelection from "./pages/PhotoSelection";

function App() {
    useEffect(() => {
        const handleBeforeUnload = () => {
            const sock = getSocket();
            sock.disconnect();
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path='/signup' element={<Signup />} />
                <Route path='/:username/home' element={<Home />} />
                <Route path='/:username/friends' element={<Friends />} />
                <Route path="/:username/chat" element={<ChatInterface />} />
                <Route path="/:username/createPost" element={<CreatePost />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/:username/selectPhoto" element={<PhotoSelection />} />
                <Route path="/:username/chatMode" element={<ChatMode />} />
                <Route path="/kafkademo" element={<KafkaDemo />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App
