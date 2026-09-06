require("dotenv").config();
console.log("JWT SECRET EXISTS:", !!process.env.JWT_SECRET);
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const supabase = require("./supabase");
const bookRoutes = require("./routes/bookRoutes");
const Book = require("./models/Book")
const authRoutes = require("./routes/auth")


const app = express(); // now app contains our backend application. express() creates are express application.

app.use(cors()); // it tells allow request coming form other origins

app.use(express.json()); // this tells express that if frontend(react) send JSON data understand it
app.use("/api/books", bookRoutes);
app.use("/api/auth", authRoutes);


mongoose.connect(process.env.MONGO_URI)
    .then(() => { 
        console.log("mongoDb connected successfully") 
    })
    .catch((error) => { 
        console.log("MongoDb didnt get connected", error) 
    });


async function testSupabase() {
    const {data, error} = await supabase.storage.listBuckets();

    if(error) {
        console.log("Error", error.message);
        return;
    }

    console.log("Supabase connected successfully!")
    console.log("Buckets", data);
}
testSupabase();
app.get("/", (req, res) => {
    res.send("Smart reader backend is working")
})

app.listen(5000, "0.0.0.0", () => { 
    console.log("server is running on 5000") 
})