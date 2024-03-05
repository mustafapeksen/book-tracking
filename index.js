import express from "express"; // Importing the express module for creating the web server
import pg from "pg"; // Importing the pg module for interacting with PostgreSQL database
import axios from "axios"; // Importing axios module for making HTTP requests
import bodyParser from "body-parser"; // Importing bodyParser module for parsing incoming request bodies

const app = express(); // Creating an instance of express
const port = 3000; // Port number on which the server will listen

app.use(express.static("public")); // Serving static files from the 'public' directory
app.use(bodyParser.urlencoded({ extended: true })); // Using bodyParser middleware to parse urlencoded request bodies

// Creating a new PostgreSQL client instance to connect to the database
const db = new pg.Client({
    user: "postgres", // PostgreSQL username
    host: "localhost", // PostgreSQL host
    database: "books", // PostgreSQL database name
    password: "Gs33peksem@", // PostgreSQL password
    port: 5432 // PostgreSQL port number
});
db.connect(); // Connecting to the PostgreSQL database

// Handling GET requests to the root endpoint
app.get("/", async (req, res) => {
    // Querying the database to retrieve book information including title, ISBN, author, etc.
    const result = await db.query("SELECT books.book_title,books.isbn,books.author , scores.date_read,scores.like_score, notes.summary FROM books JOIN scores ON books.id = scores.book_id JOIN notes ON books.id = notes.book_id ORDER BY scores.like_score DESC");

    const information = result.rows; // Storing the retrieved data from the database

    // Rendering the 'index.ejs' template with the retrieved book information
    res.render("index.ejs", { bookItems: information });
});

// Handling GET requests to the '/book/:name' endpoint
app.get("/book/:name", async (req, res) => {
    const bookName = req.params.name; // Extracting the book name from the request parameters

    // Querying the database to retrieve detailed information about a specific book
    const result = await db.query("SELECT books.book_title, books.isbn, books.author, scores.date_read, scores.like_score, notes.summary, notes.note FROM books JOIN scores ON books.id = scores.book_id JOIN notes ON books.id = notes.book_id WHERE books.book_title = $1", [bookName]);

    const information = result.rows[0]; // Storing the retrieved book information

    // Splitting the summary and note into paragraphs based on double line breaks
    const summaryParagraphs = information.summary.split('\n\n');
    const noteParagraphs = information.note.split('\n\n');

    // Fetching book cover information from the Open Library Covers API using ISBN
    const resultJson = await axios.get(`https://covers.openlibrary.org/b/isbn/${information.isbn}.json`);
    const data = resultJson.data; // Storing the fetched data

    // Rendering the 'book.ejs' template with book details, summary, note, and cover information
    res.render("book.ejs", {
        books: information,
        summaryParagraphs: summaryParagraphs,
        noteParagraphs: noteParagraphs,
        olid: data.olid
    });
});

app.get("/add", async (req, res) => {
    res.render("add.ejs");
});

// Starting the server and listening on the specified port
app.listen(port, () => {
    console.log(`Listening on port ${port}`); // Logging a message indicating that the server is running
});
