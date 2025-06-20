import { useState } from 'react'
import axios from 'axios';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const MessageComponent = ({ sender, message }: { sender: string, message: string }) => {
    return (
        <div className={`w-full flex ${sender === 'user' && 'justify-end'}`}>
            <div className={`text-left max-w-[70%] p-3 rounded-md break-words ${sender === 'user' ? 'bg-blue-100' : 'bg-slate-200'}`}>
                {message}
            </div>
        </div>
    )
}

export default function ChatInterface() {
    const [messages, setMessages] = useState([{ sender: 'chatbot', message: 'Hi there! What questions do you have?' }]);
    const [input, setInput] = useState<string>('');
    const { username } = useParams();
    const rootURL = import.meta.env.VITE_API_URL;

    const sendMessage = async () => {
        // CUT HERE 
        try {
            setMessages(prev => [...prev, { sender: 'user', message: input }]);

            console.log(input);
            var response = await axios.post(rootURL + '/' + username + '/movies', {
                username: username,
                question: input
            })
            console.log(response.data)
            setMessages(prev => [...prev, { sender: 'chatbot', message: response.data.message }])
        } catch (error) {
            setMessages(prev => [...prev, { sender: 'chatbot', message: 'Sorry, there was an issue. Please try again.' }])
        }
        // END CUT
    }

    return (
        <div className='w-screen h-screen flex'>
            <Sidebar />
            <main className="flex-1 flex flex-col items-center justify-center p-4 space-y-6">
                <h1 className="text-3xl font-bold">Natural Language Search</h1>
                <div className="h-[40rem] w-[30rem] bg-slate-100 p-3 flex flex-col">
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {messages.map((msg, i) => (
                            <MessageComponent
                                key={i}
                                sender={msg.sender}
                                message={msg.message}
                            />
                        ))}
                    </div>
                    <div className="w-full flex space-x-2 mt-4">
                        <input
                            className="w-full outline-none border-none px-3 py-1 rounded-md"
                            placeholder="Ask something!"
                            onChange={(e) => setInput(e.target.value)}
                            value={input}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    sendMessage();
                                    setInput('');
                                }
                            }}
                        />
                        <button
                            className="outline-none px-3 py-1 font-bold bg-indigo-600 text-white rounded"
                            onClick={() => {
                                sendMessage();
                            }}
                        >
                            Send
                        </button>
                    </div>
                </div>
            </main>
        </div>
    )
}
