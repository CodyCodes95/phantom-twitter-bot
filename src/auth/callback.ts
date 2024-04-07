// import { Elysia } from "elysia";

// const app = new Elysia()
//   .get("/api/callback/twitter", (req) => {
//     console.log(req.query);
//     console.log(req.session);
//     return "Hello World!";
//   })
//   .listen(3000);

// console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

// const authTwitter = async () => {
//   const client = new TwitterApi({
//     appKey: process.env.TWITTER_CONSUMER_KEY,
//     appSecret: process.env.TWITTER_CONSUMER_SECRET,
//   });
//   const authLink = await client.generateAuthLink("http://localhost:3000/api/callback/twitter");
//   console.log(authLink.url);
//   console.log(authLink.oauth_token);
//   console.log(authLink.oauth_token_secret);
// };