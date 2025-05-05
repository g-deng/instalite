import {useState, useEffect} from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios'; 
import config from '../../config.json';
import PostComponent from '../components/PostComponent'
import { useNavigate } from 'react-router-dom';
import { FiHome, FiMessageCircle, FiSearch, FiUsers, FiPlusSquare, FiLogOut } from "react-icons/fi";
import { getSocket } from "../Socket"; 
import InfiniteScroll from 'react-infinite-scroll-component';


interface PostType {
  post_id: number;
  username: string;
  image_url: string;
  text_content: string;
  hashtags: string;
  likes: number;
  comments: Array<{ username: string; comment_id: number; parent_id: number; text_content: string }>;
}


export default function Home() {

    const { username } = useParams();
    const rootURL = config.serverRootURL;
    // CUT HERE
    const [posts, setPosts] = useState<PostType[]>([]);
    // END CUT

    const [offset, setOffset]   = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const pageSize = 10;


    const navigate = useNavigate(); 

    const feed = () => {
      navigate('/' + username + '/home');
  };

  const post = () => {
    navigate("/"+username+"/createPost");
}
    const friends = () => {
        navigate("/"+ username+"/friends");
    };

    const chat = () => {
      navigate("/"+ username+"/chat");
    };

    const chatMode = () => {
      navigate("/"+ username+"/chatMode");
    };

    const logout = async () => {
      await axios.post(`${rootURL}/logout`, { withCredentials: true });
      const sock = getSocket();
      sock.disconnect();
      navigate("/");
    }

  const fetchData = async () => {
      // CUT HERE
      try {
        const { data } = await axios.get(
          `${rootURL}/${username}/feed`,
          {
            params: { limit: pageSize, offset },
            withCredentials: true
          }
        );
        //const response = await axios.get(`${rootURL}/${username}/feed`, { withCredentials: true });
        //setPosts(response.data.results);
        setPosts(prev => [...prev, ...data.results]);
        setOffset(prev => prev + data.results.length);
        setHasMore(data.hasMore);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
      // END CUT
    };

  const onLike = async (postId: number) => {
      try {
        const response = await axios.post(`${rootURL}/${username}/like`, { post_id: postId }, { withCredentials: true });
        if (response.status === 201) {
          console.log('Post liked successfully');
          fetchData(); // Refresh the posts after liking
        } else {
          console.error('Error liking post:', response.statusText);
        }
      } catch (error) {
        console.error('Error liking post:', error);
      }
    };

  const onComment = async (postId: number, parentId: number, comment: string) => {
      try {
        console.log('Comment:', comment);
        console.log('Post ID:', postId);
        console.log('Parent ID:', parentId)
        const response = await axios.post(`${rootURL}/${username}/comment`, { post_id: postId, parent_id: parentId, text_content: comment }, { withCredentials: true });
        if (response.status === 201) {
          console.log('Comment added successfully');
          fetchData(); // Refresh the posts after commenting
        } else {
          console.error('Error adding comment:', response.statusText);
        }
      } catch (error) {
        console.error('Error adding comment:', error);
      }
    };


    useEffect(() => {
      fetchData();
    }, []);


  return (
    <div className='w-screen h-screen flex flex-row'>
      {/* Sidebar */}
      <aside className="w-24 bg-white p-4 flex flex-col items-center border-r">
    <div className="mb-6">
      <span className="text-3xl font-black tracking-tight">Insta</span>
    </div>

    <button
      type="button"
      onClick={feed}
      className={`mb-6 p-2 rounded-lg flex flex-col items-center ${
         'bg-gray-100'
      }`}
    >
      <FiHome size={24} />
      <span className="text-xs mt-1">Home</span>
    </button>


    <button
      type="button"
      onClick={post}
      className={`mb-6 p-2 rounded-lg flex flex-col items-center ${
         'hover:bg-gray-100'
      }`}
    >
      <FiPlusSquare size={24} />
      <span className="text-xs mt-1">Post</span>
    </button>


    <button
      type="button"
      onClick={friends}
      className={`mb-6 p-2 rounded-lg flex flex-col items-center ${
         'hover:bg-gray-100'
      }`}
    >
      <FiUsers size={24} />
      <span className="text-xs mt-1">Friends</span>
    </button>

    <button
      type="button"
      onClick={chatMode}
      className={`mb-6 p-2 rounded-lg flex flex-col items-center ${
        'hover:bg-gray-100'
      }`}
    >
      <FiMessageCircle size={24} />
      <span className="text-xs mt-1">Chat</span>
    </button>

    <button
      type="button"
      onClick={chat}
      className={`p-2 rounded-lg flex flex-col items-center ${
        'hover:bg-gray-100'
      }`}
    >
      <FiSearch size={24} />
      <span className="text-xs mt-1">Search</span>
    </button>

    <div className="mt-auto" />
    <button
      type="button"
      onClick={logout}
      className={`p-2 rounded-lg flex flex-col items-center ${
        'hover:bg-gray-100'
      }`}
    >
      <FiLogOut size={24} />
      <span className="text-xs mt-1">Logout</span>
    </button>
    </aside>
      {/* Main Feed Column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white flex items-center justify-center border-b shadow-sm flex-shrink-0">
          <span className="text-2xl font-medium">{`Feed (@${username})`}</span>
        </header>
        {/* }
        <div className="flex-1 overflow-y-auto mx-auto w-full max-w-[600px] flex flex-col items-center space-y-4 p-4">
        {
          // CUT HERE
          posts.map(p => <PostComponent onLike={() => onLike(p['post_id'])} user={p['username']} text={p['text_content']} 
          hashtags={p['hashtags']} likes={p['likes']} comments={p['comments']} key={p['post_id']}
          onComment={(parent_id, comment)=>onComment(p['post_id'], parent_id, comment)} imageUrl={p['image_url']}/>)
          // END CUT
        }
        </div> */}

<InfiniteScroll
          dataLength={posts.length}       // tells component how many items are now in list
          next={fetchData}                // function to call when more needed
          hasMore={hasMore}               // when false, stops fetching
          loader={<p className="text-center p-4">Loading…</p>}
          endMessage={
            <p className="text-center p-4 text-gray-500">
              No more posts
            </p>
          }
          scrollableTarget="scrollableDiv"
        >
          <div
            id="scrollableDiv"
            className="overflow-y-auto mx-auto w-full max-w-[600px] flex flex-col items-center space-y-4 p-4"
            style={{ height: 'calc(100vh - 4rem)' }} // fill under header
          >
{
            // CUT HERE
            posts.map(p => <PostComponent onLike={() => onLike(p['post_id'])} user={p['username']} text={p['text_content']} 
            hashtags={p['hashtags']} likes={p['likes']} comments={p['comments']} key={p['post_id']}
            onComment={(parent_id, comment)=>onComment(p['post_id'], parent_id, comment)} imageUrl={p['image_url']}/>)
            // END CUT
}
          </div>
        </InfiniteScroll>
      </div> 

    </div>
  )
}
