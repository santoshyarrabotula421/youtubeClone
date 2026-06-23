import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

app.use(cors({
    origin : process.env.CORS_ORIGIN,
    credentials : true
}))

app.use(express.json({limit : "16kb"})) // limiting the size of incoming json
app.use(express.urlencoded({extended : true,limit :"16kb"})) // encoding url automatically
app.use(express.static("public"))
app.use(cookieParser()) // secure cookies
 
// routes import 

import userRouter from "./routes/user.routes.js"


//declare routes

app.use("/api/v1/users",userRouter)
//     https://localhost:8000

export { app }