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
    let sortBy = req.query.sortBy || 'best'; // Varsayılan sıralama kriteri

    let query = "SELECT books.book_title, books.isbn, books.author, books.id, scores.date_read, scores.like_score, notes.summary " +
        "FROM books JOIN scores ON books.id = scores.book_id JOIN notes ON books.id = notes.book_id ";

    console.log(req.query.sortBy);


    switch (sortBy) {
        case 'newest':
            query += "ORDER BY books.id DESC";
            break;
        case 'best':
            query += "ORDER BY scores.like_score DESC";
            break;
        case 'title':
            query += "ORDER BY books.book_title ASC";
            break;
        default:
            query += "ORDER BY scores.like_score DESC";
    }

    try {
        const result = await db.query(query);
        console.log(req.query);
        const information = result.rows;
        res.render("index.ejs", { bookItems: information });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
    }
});


// Handling GET requests to the '/book/:name' endpoint
app.get("/book/:id", async (req, res) => {
    try {
        const bookId = req.params.id; // Get the book name from the URL parameter

        // Query the database to retrieve detailed information about a specific book
        const result = await db.query("SELECT books.book_title,books.id, books.isbn, books.author, scores.date_read, scores.like_score, notes.summary, notes.note" +
            " FROM books JOIN scores ON books.id = scores.book_id JOIN notes ON books.id = notes.book_id WHERE books.id = $1", [bookId]);

        const information = result.rows[0]; // Store the retrieved book information

        // Split the summary and note into paragraphs based on double line breaks
        const summaryParagraphs = information.summary.split('\n\n');
        const noteParagraphs = information.note.split('\n\n');

        // Fetch book cover information from the Open Library Covers API using ISBN
        let olid;
        try {
            const resultJson = await axios.get(`https://covers.openlibrary.org/b/isbn/${information.isbn}.json`);
            const data = resultJson.data; // Store the retrieved data
            olid = data.olid;
        } catch (error) {
            console.error("An error occurred during the API request:", error);
            // If there is an error with the API request, olid can be left empty or assigned a default value
        }

        // Render the 'book.ejs' template with book details, summary, note, and cover information
        res.render("book.ejs", {
            books: information,
            summaryParagraphs: summaryParagraphs,
            noteParagraphs: noteParagraphs,
            olid: olid
        });
    } catch (error) {
        // Handle any errors that occur during the process
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.get("/add", async (req, res) => {
    res.render("add.ejs");
});


function capitalizeEveryWord(sentence) {
    // Convert the sentence to lowercase and split it into words
    const words = sentence.split(" ");

    // Capitalize the first letter of each word
    for (let i = 0; i < words.length; i++) {
        words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1);
    }

    // Join the capitalized words back into a sentence
    return words.join(" ");
};




app.post("/add", async (req, res) => {
    const bookTitle = capitalizeEveryWord(req.body.book_title);
    const isbn = capitalizeEveryWord(req.body.isbn);
    const author = capitalizeEveryWord(req.body.author);
    const summary = req.body.summary;
    const note = req.body.note;
    const likeScore = req.body.like_score;
    const dateRead = req.body.date_read;

    try {
        // Inserting values into respective tables
        await db.query("INSERT INTO books(book_title, isbn, author) VALUES($1, $2, $3)", [bookTitle, isbn, author]);
        // Getting the auto-generated id of the newly inserted book
        const result = await db.query("SELECT lastval()");
        const bookId = result.rows[0].lastval;
        
        await db.query("INSERT INTO notes(summary, note, book_id) VALUES($1, $2, $3)", [summary, note, bookId]);
        await db.query("INSERT INTO scores(like_score, book_id, date_read) VALUES($1, $2, $3)", [likeScore, bookId, dateRead]);

        res.redirect("/");
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.get("/edit/:id", async (req, res) => {
    try {
        const bookId = req.params.id; // Get the book name from the URL parameter

        // Query the database to retrieve detailed information about a specific book
        const result = await db.query("SELECT books.book_title,books.id, books.isbn, books.author, scores.date_read, scores.like_score, notes.summary, notes.note" +
            " FROM books JOIN scores ON books.id = scores.book_id JOIN notes ON books.id = notes.book_id WHERE books.id = $1", [bookId]);


        const information = result.rows[0]; // Store the retrieved book information

        // Split the summary and note into paragraphs based on double line breaks
        const summaryParagraphs = information.summary.split('\n\n');
        const noteParagraphs = information.note.split('\n\n');

        // Fetch book cover information from the Open Library Covers API using ISBN
        let olid;
        try {
            const resultJson = await axios.get(`https://covers.openlibrary.org/b/isbn/${information.isbn}.json`);
            const data = resultJson.data; // Store the retrieved data
            olid = data.olid;
        } catch (error) {
            console.error("An error occurred during the API request:", error);
            // If there is an error with the API request, olid can be left empty or assigned a default value
        }
        // Render the 'book.ejs' template with book details, summary, note, and cover information
        res.render("edit.ejs", {
            books: information,
            summaryParagraphs: summaryParagraphs,
            noteParagraphs: noteParagraphs,
            olid: olid
        });
    } catch (error) {
        // Handle any errors that occur during the process
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.post("/edit/:id", async (req, res) => {
    try {
        const bookTitle = capitalizeEveryWord(req.body.book_title);
        const isbn = capitalizeEveryWord(req.body.isbn);
        const author = capitalizeEveryWord(req.body.author);
        const summary = req.body.summary;
        const note = req.body.note;
        const likeScore = req.body.like_score;
        const dateRead = req.body.date_read;
        const bookId = req.params.id; // Parametreyi düzeltin

        // Query the database to retrieve detailed information about a specific book
        const result = await db.query("SELECT books.book_title, books.isbn, books.author FROM books WHERE id = $1", [bookId]);
        const information = result.rows[0]; // Store the retrieved book information

        let olid = ''; // Default bir değer atayın

        // ISBN varsa API isteğini yapın
        if (information && information.isbn) {
            try {
                const resultJson = await axios.get(`https://covers.openlibrary.org/b/isbn/${information.isbn}.json`);
                const data = resultJson.data; // Store the retrieved data
                olid = data.olid;
            } catch (error) {
                console.error("An error occurred during the API request:", error);
            }
        }

        // Veritabanını güncelleyin
        await db.query("UPDATE books SET book_title = $1, isbn = $2, author = $3 WHERE id = $4", [bookTitle, isbn, author, bookId]);
        await db.query("UPDATE notes SET summary = $1, note = $2 WHERE book_id = $3", [summary, note, bookId]);
        await db.query("UPDATE scores SET like_score = $1, date_read = $2 WHERE book_id = $3", [likeScore, dateRead, bookId]);
        res.redirect(`/book/${bookId}`);

    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.post("/delete", async (req, res) => {
    const deleteId = req.body['book-id'];
    await db.query("DELETE FROM scores WHERE book_id = $1", [deleteId]);
    await db.query("DELETE FROM notes WHERE book_id = $1", [deleteId]);
    await db.query("DELETE FROM books WHERE id = $1", [deleteId]);

    res.redirect("/");
});

// Starting the server and listening on the specified port
app.listen(port, () => {
    console.log(`Listening on port ${port}`); // Logging a message indicating that the server is running
});


