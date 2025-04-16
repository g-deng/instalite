import { getHelloWorld, postLogin, postRegister, getFriends, getFriendRecs, getMovie, uploadImage } from './routes.js';
import { createPost, getFeed, getKafkaDemo } from './feed_routes.js';
import {get_embedding, get_topk} from './embedding_routes.js';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });
import { getHelloWorld, postLogin, postRegister, getFriends, getFriendRecs, createPost, getFeed, getMovie } from './routes.js';
import { sendChatInvite, acceptChatInvite, getUserProfile, getUserChats, getChatMessages, getUserFriends, leaveChat, checkGroupValidity } from './chat_routes.js';
import './routes.js'

function register_routes(app) {
    app.get('/hello', getHelloWorld);
    app.post('/login', postLogin);
    app.post('/register', postRegister); 
    app.get('/:username/friends', getFriends);
    app.get('/:username/recommendations', getFriendRecs);
    app.post('/:username/createPost', createPost); 
    app.get('/:username/feed', getFeed); 
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
  }
  
  export default register_routes;