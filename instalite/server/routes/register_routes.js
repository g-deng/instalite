import { getHelloWorld, postLogin, postRegister, getFriends, getFriendRecs, getMovie } from './routes.js';
import { createPost, getFeed } from './feed_routes.js';
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
  }
  
  export default register_routes;