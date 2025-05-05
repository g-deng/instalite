import {
    getHelloWorld,
    postLogin,
    postRegister,
    getMovie,
    uploadImage,
    getOnlineUsers,
    selectPhoto,
    saveUserSelfie,
    getEmbeddingFromSelfieKey,
    postLogout,
    getPopularHashtags,
    updateHashtags,
} from './routes.js';
import {
    getFriends,
    getFriendRecs,
    addFriend,
    removeFriend,
} from './friend_routes.js';
import {
    createPost,
    getFeed,
    getKafkaDemo,
    createLike,
    createComment,
} from './feed_routes.js';
import { postComputeRanks } from '../algorithms/run_compute_ranks.js';
import { get_embedding, get_topk } from './embedding_routes.js';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });
import {
    sendChatInvite,
    acceptChatInvite,
    getUserProfile,
    getUserChats,
    getChatMessages,
    getUserFriends,
    leaveChat,
    checkGroupValidity,
} from './chat_routes.js';
import './routes.js';

function register_routes(app) {
    app.get('/hello', getHelloWorld);
    app.post('/login', postLogin);
    app.post('/register', postRegister);
    app.get('/:username/friends', getFriends);
    app.get('/:username/recommendations', getFriendRecs);
    app.post('/:username/addFriend', addFriend);
    app.post('/:username/removeFriend', removeFriend);
    app.get('/:username/onlineUsers', getOnlineUsers);
    app.post('/logout', postLogout);
    app.post('/:username/selectPhoto', upload.single('image'), selectPhoto);
    app.post('/getEmbeddingFromSelfieKey', getEmbeddingFromSelfieKey);

    // FEED
    app.post('/:username/createPost', upload.single('image'), createPost);
    app.get('/:username/feed', getFeed);
    app.post('/:username/like', createLike);
    app.post('/:username/comment', createComment);

    // SPARK
    app.post('/api/computeRanks', postComputeRanks);

    app.post('/:username/movies', getMovie);
    app.post('/upload', upload.single('image'), uploadImage);
    app.get('/embeddings/:name', get_embedding);
    app.post('/match', get_topk);
    app.get('/kafkademo/:topic', getKafkaDemo);
    app.post('/:username/sendChatInvite', sendChatInvite);
    app.post('/:username/acceptChatInvite', acceptChatInvite);
    app.get('/:username/profile', getUserProfile);
    app.get('/:username/chats', getUserChats);
    app.get('/:username/chat/:roomId', getChatMessages);
    app.get('/:username/userFriends', getUserFriends);
    app.get('/:username/chats/:roomId/messages', getChatMessages);
    app.post('/:username/leaveChat', leaveChat);
    app.post('/:username/checkGroupValidity', checkGroupValidity);
    app.post('/saveUserSelfie', saveUserSelfie);
    app.get('/popularHashtags', getPopularHashtags);
    app.post('/:username/updateHashtags', updateHashtags);
}

export default register_routes;
