import { useState } from 'react';
import axios from 'axios';
import PostComponent from '../components/PostComponent';

function KafkaDemo() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [posts, setPosts] = useState<any[]>([]);
    const [topic, setTopic] = useState<'BlueSky' | 'FederatedPosts'>('BlueSky');
    const rootURL = import.meta.env.VITE_API_URL;

    const switchPosts = async () => {
        const response = await axios.get(`${rootURL}/kafkademo/${(topic === 'BlueSky') ? 'FederatedPosts' : 'BlueSky'}`);
        setPosts(response.data.results);
        console.log(response.data.results);
        if (topic === 'BlueSky') {
            setTopic('FederatedPosts');
        } else {
            setTopic('BlueSky');
        }
    };

    return (
        <div className="page-container">
            <div className="heading">Kafka Posts</div>
            <div className="toolbar">
                <button onClick={switchPosts}>
                    {`Showing ${topic}. Click to switch.`}
                </button>
            </div>
            <div className="results">
                {posts.map(p => (
                    <PostComponent
                        user={p['username']}
                        text={p['content']}
                        likes={p['likes'] || 0}
                        comments={p['comments'] || []}
                        onLike={() => console.log(`Liked post ${p['post_id']}`)}
                        onComment={(_, text) => console.log(`Commented on post ${p['post_id']}: ${text}`)}
                        key={p['post_id']}
                    />
                ))}
            </div>
        </div>
    );
}

export default KafkaDemo;