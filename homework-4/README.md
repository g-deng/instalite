[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=18971667&assignment_repo_type=AssignmentRepo)
# Homework 4

In this homework, you will be building components of a basic social media application, preparing you for the final course project. You will be working with the same IMDb dataset as you have been using up until this point, but now you will be focusing on adding `users` and `posts` to the application.

You will:
1. Implement a notion of user credentials and logins, with encrypted passwords.
1. Implement a variety of RESTful API routes related to common social media application operations. 
2. Work with React components to interact with your routes and create a functional frontend. 
1. Start deploying your data onto the cloud.


## Setup

### Clone the Code

Once you accept the GitHub Classroom assignment, you will have a private repository with the
name `homework-4-{myid}`. This repository contains the starter code for the assignment. **Change `{myid}` to your
PennKey.**

Here is how you will check out the `homework-4` to your machine:

1. Navigate to the GitHub repository of _your_ homework-4-{myid} assignment.
2. Click the green Code button and copy the SSH link.
3. Open up your local terminal/command-line interface and `cd` to `~/nets2120`. (On
   Windows: `cd %userprofile%\nets2120`).
4. Clone the repository by running `git clone <ssh link> homework-4`. This should create a new
   folder `homework-4` with the contents of the repository inside of your `nets2120` directory.

### Launch Docker

1. Launch the Docker Desktop app and make sure your NETS 2120 container is started.
1. Open VSCode, Attach to the Container, and use Open Folder to open your `homework-4` project.

## Part 1: Backend User Data

For the first part, you will implement **user accounts**, **friends functionality**, and basic **posts**. 

Node.js setup: as per prior assignments, you should be able to do:

```
nvm use 22.13.1
npm install
```

If you get an error, try: `source install-nvm.sh` and then `source ~/.bashrc` and then repeat the above.

### <ins>1a: Setting up new tables</ins>

We will continue to build off your HW2/HW3 database.
You should create two MySQL tables (populate the SQL commands in [create_tables.js](server/models/create_tables.js) to do this). An example query for creating the `friends` table is included for your reference. The schema for these tables should be the following: 

- Table name: **users**
  - user_id: int, can't be null, is an AUTO INCREMENT, and is a PRIMARY KEY.
  - username: varchar of size 255
  - hashed_password: varchar of size 255
  - linked_nconst: varchar of size 255,  foreign key to the `nconst` field in `names`
- Table name: posts
  - post_id: int, can't be NULL, auto-incremented primary key 
  - parent_post: int, foreign key reference to `post_id` in `posts` (this will be the ID of a post's parent post once we start implementing threads)
  - title: varchar of size 255
  - content: varchar of size 255
  - author_id: int,  foreign key to `user_id` in `users`

Then, run `npm run create_tables` in your terminal to run this file. You should be able to see the impact immediately through the VSCode Database Extension.

#### If You Don't Have a Complete Database from HW2/3

We recommend you re-run the loader code in HW2 `datasets` (`mvn exec:java@loader`).

### <ins>1b: RESTful Backend API</ins>

As is now our tradition, the `server` directory contains the backend code for our REST APIs.
In [`routes.js`](server/routes/routes.js), you will be creating the backend service using Node.js.

#### Configuration Setup
To connect your backend service to an AWS RDS instance, you will need to (1) create a `.env` file with credentials, and (2) modify [config.json](config.json) to use the connection information for your RDS database.

`.env` should have items from your AWS Academy Details first, then the database user ID and the password we've been using (refer to Ed Discussion), then an OpenAPI key (we will provide one on Ed Discussion):
```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AUTH_TOKEN=...
DATABASE_SERVER=localhost
DATABASE_NAME=imdb_basic
DATABASE_USER=nets2120_hw2
DATABASE_PASSWORD=
OPENAI_API_KEY=
USE_PERSISTENCE=TRUE
```

**Important: each time you open a new Terminal in your Docker container, you should `source .env` from the `homework-4` directory.  ChromaDB, npm, and other tools will rely on this.**


You will likely want to leave `config.json` alone but it (also) specifies how to connect to MySQL.

```json
{
  "database": {
    "host": "localhost",
    "port": "3306",
    "database": "imdb_basic"
  },
  "serverPort": "8080"
}
```

You will rely on an SSH tunnel to connect to the RDS instance.

#### ChromaDB

For the LLM portion of the assignment, you will want to use *ChromaDB* as your vector store, and have it look up IMDB movie reviews.  You should still have ChromaDB as part of your setup, but if not: run `source chroma_setup.sh`.

* We've pre-indexed the data and you can download from [here](https://penn-cis545-files.s3.amazonaws.com/chromadb.zip)
* Copy it from your host machine into your shared `nets2120` directory
* From a terminal *within Docker* (open using VSCode or `docker -it nets2120 bash`):
  * Move into the `data` directory under your `homework-4` directory.
  * From there, unzip so you see `data`, then `chromadb` as a subdirectory.
  * Now, in the `homework-4` directory, run `source run_chroma.sh`.

#### API Specifications
The main program, [app.js](app.js), registers route handlers. You'll need to look at [register_routes.js](routes/register_routes.js) and [routes.js](routes/routes.js) to fill in the stubbed code for the following routes. (`Register_routes` is mostly complete except for one route registration, but `routes` generally has blank function bodies). In `routes.js`, use `db.send_sql()` (found in [rdbms.js](server/models/rdbms.js)) to send queries to your database, in the same way that `queryDatabase()` worked in Homework 2 MS2.  

**BEWARE SQL INJECTION ATTACKS for any parameters taken from the client. For simplicity we won't be using prepared statements, so you should filter the allowed characters / strings.  Note we have provided a function to help with that, which disallows quotes and other characters that might result in SQL injection. **

You should find a couple of useful functions in [route_helper.js](server/routes/route_helper.js), to do pattern matching
of strings and to compare values with session information.

- `/register` accepts POST requests with the following **body** parameters: 
  - `username`
  - `password`
  - `linked_id`
  
  To register a user, add the given information about the user into the `users` table. 
  
  Make sure that you *salt and hash* the raw password text (see our lecture on computer security) passed in through the body parameters and are only storing the `hash` in the database. We will be doing this using `bcrypt`, which you can find more information about [here](https://www.npmjs.com/package/bcrypt).

  For convenience we have modularized out your encryption function into [route_helper.js](server/routes/route_helper.js) -- you should fill in the body of `encryptPassword(raw_pass, callback)`.  You can call it as `helper.encryptPassword(...)` in `postRegister` to get your desired hash before inserting the user info into the table. 

  When the registration is successful, return a status `200` with the following example response structure: `{username: 'rpeng'}`.

  - **Error handling:**
    - Return status `400` with JSON `{error: 'One or more of the fields you entered was empty, please try again.'}` for invalid query parameters. These include when: 
      - `username` is not provided.
      - `password` is not provided.
      - `linked_id` is not provided. 
    - Return status `409` (Conflict) with JSON `{error: "An account with this username already exists, please try again."}` when the username already exists in the database. 
    - Return status `500` with JSON `{error: 'Error querying database.'}` for any database query errors. 

- `/login` accepts POST requests with the following **body** parameters:
  - `username`
  - `password`
 
  Use `bcrypt` to compare the password given in the login attempt with the hash stored in the `users` table for the user with the given `username`. When the login attempt is successful, return a status `200` with the following example response structure: `{username: 'rpeng'}`.

  - **Error handling:**
    - Return status `400` with JSON `{error: 'One or more of the fields you entered was empty, please try again.}` for invalid query parameters. These include when: 
      - `username` is not provided.
      - `password` is not provided.
    - Return status `500` with JSON `{error: 'Error querying database'}` for any database query errors. 
    - Return status `401` (Unauthorized) with JSON `{error: Username and/or password are invalid.'}`. 

  - **Session management:**
    - If the login attempt is successful, we would like to store the current logged in user's information in the browser's session object. 
    - When a user is logged in, store the `user_id` of that user in the session object using `req.session.user_id`. 


- `/logout` accepts GET requests and removes the current user from the `req.session` object (set `req.session.user` to `null`). 
  - After successfully logging the user out, return a status 200 with `{message: "You were successfully logged out."}` in the response. 

The following functions should all test whether the `req.session` information indicates the user is logged in -- if not they should return an error (see codes below).


- `/:username/friends` accepts GET requests and returns an array of UNIQUE friends that the current user followss in the session. This should only be allowed if a user is logged in. 

  You should select the `nconst` and `primaryName` of every person who is *followed* by the current session user (who should be the *follower*). (Hint: you may want to use multiple JOINs to link the `users`, `friends`, and `names` tables together).

  When getting friends is successful, return a status `200` with a result that looks like this: 

  ```
  const response = {
    results: [
      {
        followed: "nm0784407",
        primaryName: "Mack Sennett"
      }, 
      {
        followed: "nm1802226",
        primaryName: "Joseph Maddern"
      }
    ]
  }
  ```

  - **Error handling:**
    - Return status `403` (Forbidden) with JSON `{error: 'Not logged in.'}` if there is no user logged in. 
    - Return status `500` with JSON `{error: 'Error querying database'}` for any database query errors. 


- `/:username/recommendations` accepts GET requests and returns an array of friend recommendations for the current user in the session. 

  You should select the `recommendation` and `primaryName` of every person who is *recommended* by the current session user (who should be the *person*). 

    When getting friends is successful, return a status `200` with a result that looks like this: 

    ```
    const response = {
      results: [
        {
          recommendation: "nm0784407",
          primaryName: "Mack Sennett"
        }, 
        {
          recommendation: "nm1802226",
          primaryName: "Joseph Maddern"
        }
      ]
    }
    ```

  - **Error handling:**
    - Return status `403` (Forbidden) with JSON `{error: 'Not logged in.'}` if there is no user logged in. 
    - Return status `500` with JSON `{error: 'Error querying database'}` for any database query errors. 


- `/:username/createPost` accepts POST requests with the following **body** parameters: 
  - `title`
  - `content`
  - `parent_id`

  Only allow this route if a user is logged in. The ID of the current session user should be the `author_id`.   Screen the title and content to only be alphanumeric characters, spaces, periods, question marks, commas, and underscores (e.g., no quotes, semicolons, etc.) to protect against SQL injection.

  Upon successful post creation, return a **status 201** with the response `{message: "Post created."}`.

  - **Error handling:**
    - Return status `403` (Forbidden) with JSON `{error: 'Not logged in.'}` if there is no user logged in. 
    - Return status `400` with JSON `{error: 'One or more of the fields you entered was empty, please try again.'}` if any of the provided body params are empty. 
    - Return status `500` with JSON `{error: 'Error querying database.'}` for any database query errors. 

- `/:username/feed` accepts GET requests
  - Write a query that returns an array of posts that should be in the current session user's feed. For each post, `SELECT` the post id, author's username, parent post id, title, and content 
  - When getting the feed is successful, return a status `200` with a result that looks like this: 
  ``` 
  const response = {
    results: [
      {
        username: 
        parent_post: 
        title: 
        content:
      },
      {
        username: 
        parent_post: 
        title: 
        content:
      }
    ] 
  }
  ```
  - **Error handling:**
    - Return status `403` (Forbidden) with JSON `{error: 'Not logged in.'}` if there is no user logged in. 
    - Return status `500` with JSON `{error: 'Error querying database.'}` for any database query errors. 

- `/:username/movies` accepts POST requests
   - Register `getMovie` in `register_routes.js`
   - Define a PromptTemplate for the LLM that tells it to answer the question given a context and a question.
   - Create a ChatOpenAI() agent for the `llm` variable. Pick gpt-3.5-turbo or one of its variations.
   - Check out the [Langchain docs](https://js.langchain.com/docs/get_started/introduction) if you have any questions about the code given to you. 

#### Running the Server: 
To run the server, you will need to install the required packages using `npm install` and then run the server using `npm run start` from inside the `homework-4` directory and from the Docker terminal. The server will be running on `http://localhost:8080`.

### <ins>Part 3: Frontend Design</ins>
Starter code is provided for you for the pages and components that we would like to see in the frontend. Please go through the following tasks and complete the TODOs mentioned in the code. The frontend is in `frontend` and **has its own `package.json`** requiring you to do `npm install` and `npm run dev` from that subdirectory.

#### Task 1: Sign Up Page
For this task, you will be working in [`Signup.tsx`](frontend/src/pages/Signup.tsx). 
- Use `useState` to store the four user inputs on this page: `username`, `password`, `confirmPassword`, `linked_nconst`
- Then, complete the `handleSubmit` function, which should make a backend call to the `/register` route to register a user with the information that is inputted to the form.
- If the registration is successful, use `navigate()` to redirect the user to the `/home` page. 
- If registration is unsuccessful, use `alert()` to send an alert to the user with the message "Registration failed." 

#### Task 2: Login Page
Navigate to [`Login.tsx`](frontend/src/pages/Login.tsx).
- Complete the `handleLogin` function, which should make a backend call to the `/login` route to check user credentials. 
- If the login attempt is successful, use `navigate()` to redirect the user to the `/home` page. 
- If login attempt is unsuccessful, use `alert()` to send an alert to the user with the message "Log in failed." 

#### Task 3: Friends Page 
Navigate to [`Friends.tsx`](frontend/src/pages/Friends.tsx). Here, you will find three TODOs. 
- Use `useEffect()` to make backend calls to `/:username/friends` and `/:username/recommendations` to get the user's friends and recommendations. 
- Use `.map()` in  to map each friend to a `FriendComponent` and fill in the necessary information about each friend in the component. 
- Use `.map()` again to map each recommendation to a `FriendComponent` as well with the correct information. 

#### Task 4: Home Page
Navigate to [`Home.tsx`](frontend/src/pages/Home.tsx). This page is very similar to the Friends page, except now we have posts. Again, there are two TODOs on this page. 
- Use `useEffect()` to make a backend call to `/feed` to get all the posts that should be in the current user's feed. 
- Use `.map()` to map each post to a `PostComponent` (which you can find in `./components/PostComponent.tsx`), and fill in the necessary details for each post in the component.

#### Task 5: Chat Interface
Navigate to [`ChatInterface.tsx`](frontend/src/pages/ChatInterface.tsx).
- Complete the `sendMessage()` function to call the backend's `:username/movies` endpoint, process the response, and call `setMessages` with that response.

#### Running the frontend
To run the frontend, you will need to install the required packages using `npm install` and then run the app using `npm run dev --host` from inside the `frontend` directory and from the Docker terminal. The frontend will be running on `http://localhost:4567`.

## Porting to Amazon

Once your homework is working successfully, you should validate it on AWS.  This involves two steps:

1. Port the database to Amazon RDS
1. Pull the code to EC2

Moreover, we need to make sure the EC2 node, RDS, and (for your project) EMR can all talk -- requiring them to be on the same **Virtual Private Cloud**.

### Connecting to AWS Learning Lab:

As before:
1. Open your project in VSCode and Attach to the Container. If necessary Open the Folder for `homework-4`.
1. Launch AWS Learner Lab and click on Start Lab.
1. In VSCode, create a new file called `credentials`. Copy and paste the Details (AWS key, secret key, token and the `[default]` header) into that file.
1. From the Terminal, `cp credentials ~/.aws`

**Note**: As always Each session lasts for 4 hours max, and credentials must be re-entered each session in Learner's Lab.

### Setting up MySQL Access for EC2 (and EMR)

Next you will create an instance in Amazon RDS, which you will populate with the contents of your local MySQL database.

**Creating a Database Dump**. To port our database to RDS, we will first run:

```
service mysql start
mysqldump -u root imdb_basic > db.sql
service mysql stop
```
**Launching an RDS Instance.**

At the top of the AWS Console, type `RDS` into the search bar, and click on **Aurora and RDS**.

- Click on **Create Database**.
- Choose **"Standard create"**.
- Select **MySQL** (**MariaDB** should also work).
- Select **Free tier** as the **Template**.
- For **Availability and Durability**, make sure **Single-AZ DB instance deployment** is set.
- Call the instance `imdb-basic` (note the hyphen instead of the underscore, since RDS doesn't allow underscores).
- In Instance Configuration, select **Burstable classes**. Choose `db.t4g.medium`.  The 'g' indicates a Gravitron (ARM) processor that can get extra resources in bursts ('t' series).
- In **Connectivity**, make sure the **Default VPC** is set.
- Under **Existing VPC Security Groups** select **ElasticMapReduce-master** and **ElasticMapReduce-slave**.  This will ultimately allow you to access your database from EMR and EC2.

Once the database is created, **View Connection Details**.  Copy the Endpoint address, which will look something like: `imdb-basic.c6mkpyqhzfar.us-east-1.rds.amazonaws.com`.  **This name should be the same each time you restart the lab.**


### EC2 Micro Instance Setup [Every Time You Launch the Learner Lab]

In the *AWS Console*, go to **EC2**, and from the **Dashboard** click on **Launch Instance**.

1. Name the instance `Tunnel`.
1. Pick *Ubuntu* from the Application and OS Images Quick Start and select Ubuntu Server 22.04 LTS.  Confirm changes.
1. Scroll down to **Instance Type** and pick **t2.micro**.
1. Create a new keypair, called `nets_2120_remote_keypair.pem` and download it.
1. Go back to the EC2 instance tab, hit the refresh icon next to "Create a new keypair" and select your new keypair.
1. Under **Network settings**, Firewall (security groups), **Select existing group** and check all of **default** and **ElasticMapReduce-master** and **ElasticMapReduce-slave**.
1. **Allow ssh traffic** from anywhere.
1. Configure storage to 16GB.

Then: launch your instance!  Click through on the instance link in the green bar.  Click through on the underlined instance ID for "Tunnel".  Copy / jot down the **Public IPv4 DNS**.

#### Keypair Setup for EC2

On your host OS, copy your downloaded `nets_2120_remote_keypair.pem` to your `nets2120` base directory.  Then, in the VSCode Docker container Terminal:

```
chmod 400 ~/nets2120/nets_2120_remote_keypair.pem
cp ~/nets2120/nets_2120_remote_keypair.pem ~/.ssh
```

#### EC2 Node Installation / Setup

You will probably want ChromaDB on this instance.  You can `ssh -i ~/.ssh/nets2120_remote_keypair.pem ubuntu@`*remoteMachine*.

Then:
```
sudo apt update
sudo apt install -y python3 python3-pip unzip
wget https://penn-cis545-files.s3.amazonaws.com/chromadb.zip
unzip chromadb.zip
sudo pip3 install chromadb
sudo nano /etc/systemd/system/chromadb.service
```

From `nano`, paste in the following:

```
[Unit]
Description=ChromaDB Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/chromadb
ExecStart=/usr/local/bin/chroma run --path /home/ubuntu/chromadb
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Hit Ctrl-X and save.  Now run:
```
sudo systemctl daemon-reload
sudo systemctl enable chromadb.service
sudo systemctl start chromadb.service
```

Run `sudo systemctl status chromadb.service` and you should see something like:
```
● chromadb.service - ChromaDB Service
     Loaded: loaded (/etc/systemd/system/chromadb.service; enabled; vendor preset: enabled)
     Active: active (running) since Sun 2025-03-23 18:27:57 UTC; 2s ago
   Main PID: 3693 (chroma)
      Tasks: 7 (limit: 1129)
     Memory: 97.9M
        CPU: 1.517s
     CGroup: /system.slice/chromadb.service
             └─3693 /usr/bin/python3 /usr/local/bin/chroma run --path /home/ubuntu/chromadb
```

#### Link RDS and EC2 Nano Instance

From your browser, go into the AWS Console's EC2 Dashboard. Click on the details of your `tunnel` server. Under the **Networking** menu, click **Connect RDS database**. Click on the **Instance** button, then select your RDS database (imdb-basic) from the drop-down. Hit **Connect**.


#### Setting up the Tunnel

Once things are configured as per above, anything you run on EC2 should be able to connect to your database instance, by the name of the RDS server, e.g., `imdb-basic.czkkqa8wuy3r.us-east-1.rds.amazonaws.com`.  Anything you run on EC2 should be able to connect to ChromaDB at `localhost:8000`.  However, you'll probably *also* want these to be connectable via your laptop / Docker container.

Collect the two hostnames from above:
1. The name of your RDS server, e.g., `imdb-basic.czkkqa8wuy3r.us-east-1.rds.amazonaws.com`
2. The name of your EC2 tunnel server, e.g., `ec2-3-86-71-131.compute-1.amazonaws.com`

### Tunneling to MySQL on RDS

Before you do this command, make sure MySQL is no longer running in your container. Run `service mysql stop`.

Now edit this command, setting the `dbserver` and `tunnelserver` (it should be a single line):

```
ssh -i ~/.ssh/nets_2120_remote_keypair.pem -4 -L 3306:dbserver:3306 ubuntu@tunnelserver
```

As an example, here is a version that worked for us:

```
ssh -i ~/.ssh/tunnel.pem -4 -L 3306:database-2.czkkqa8wuy3r.us-east-1.rds.amazonaws.com:3306 ubuntu@ec2-3-86-71-131.compute-1.amazonaws.com
```

**First-Time You Connect to the New Tunnel**. The first time you create the tunnel server, may need to answer `yes` to whether you trust the server.  You'll be logged into an Amazon EC2 node at this point.

Until `ssh` exits, you'll have a "tunnel" set up so requests in your container for `localhost` port `3306` get redirected to the tunnel server; then it makes requests to the database server on your behalf.

Leave this terminal open until you are done. Create another VSCode container Terminal to do work.

### Connecting to RDS and Loading the Database

Now go to the AWS Secrets Manager.  Under Secrets, find an entry starting with `rds!db` -- this is where your admin user for your RDS database is.

Under Secret value, click Retrieve secret value.  You should see a username of `admin` and a password -- copy the latter.

In VSCode's Database Extension, at the very top of the pane, hit the + to add another database. Name it RDS, select MariaDB, leave the Host at localhost and set the port to 3306. Set the username to `admin` and the password to be your copied password. Leave Database blank, save, and Connect.

Now under "RDS", hit the [+] and then expand the line to:

```
CREATE DATABASE imdb_basic
    DEFAULT CHARACTER SET = 'utf8mb4'
```

```
CREATE USER nets2120_hw2 identified by 'XXXX';
grant all privileges on imdb_basic.* to nets2120_hw2;
```

where `XXXX` is the password we have been using for MySQL.

Finally, go to your Terminal (in VSCode, Docker coontainer)( and run: `mysql -h 127.0.0.1 -P 3306 -u admin -p imdb_basic < db.sql`.  Enter the admin password from RDS.

This should copy the data to RDS.  At this point you don't need the tunnel, etc. unless you want to connect to the datbase from VSCode.  From now on you'll be accessing the database from your EC2 server.

### Connecting to ChromaDB on EC2

We can do a similar thing to access ChromaDB running on Amazon: open another Terminal in your VSCode attached to the container.  Run:

```
ssh -i ~/.ssh/nets_2120_remote_keypair.pem -4 -L 8000:localhost:8000 ubuntu@tunnelserver
```

where `tunnelserver` is again the remote server.

### Re-Running Your Code with Cloud Storage

Verify that your backend (and frontend!) works with both ChromaDB and MySQL executing remotely.

Once this works, run from your Docker Terminal from your `homework-4` directory:

```
echo ubuntu@tunnelserver > remote-site.txt
git add remote-site.txt
```

and push and commit to the repository.

## What to Submit

Remember to submit to Gradescope:
* Updated backend with endpoints enabled
* Updated frontend with state management
* Feedback in `feedback.yaml`
* New file `remote-site.txt`