create database if not exists imdb_basic;
create user if not exists 'instalite_user' identified by 'instalite_password';
grant all privileges on imdb_basic.* to 'instalite_user';
\q