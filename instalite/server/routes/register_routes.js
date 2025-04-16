import { getHelloWorld, postLogin, postRegister, getFriends, getFriendRecs, getMovie, uploadImage } from './routes.js';
import { createPost, getFeed, getKafkaDemo } from './feed_routes.js';
import {get_embedding, get_topk} from './embedding_routes.js';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });

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
  }
  
  export default register_routes;