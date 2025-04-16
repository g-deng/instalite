import { useState } from 'react';
import axios from 'axios';
import config from '../../config.json';
import PostComponent from '../components/PostComponent';

function KafkaDemo() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [posts, setPosts] = useState<any[]>([]);
    const [topic, setTopic] = useState<'BlueSky' | 'FederatedPosts'>('BlueSky');
    const rootURL = config.serverRootURL;

    const switchPosts = async () =>  {
        if (topic === 'BlueSky') {
            setTopic('FederatedPosts');
        } else {
            setTopic('BlueSky');   
        }
        const response = await axios.get(`${rootURL}/kafkademo/${topic}`);
        setPosts(response.data.results);
        console.log(response.data.results);
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
                {posts.map(p => <PostComponent title={p['title']} user={p['username']} description={p['content']} key={p['post_id']}/>)}
            </div>
        </div>
    );
}

export default KafkaDemo;