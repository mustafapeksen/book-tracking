import express from "express"; // Importing the express module for creating the web server
import axios from "axios"; // Importing axios module for making HTTP requests
import bodyParser from "body-parser"; // Importing bodyParser module for parsing incoming request bodies
import pkg from 'pg';
const { Client } = pkg;
const app = express(); // Creating an instance of express
const port = 3000; // Port number on which the server will listen

app.use(express.static("public")); // Serving static files from the 'public' directory
app.use(bodyParser.urlencoded({ extended: true })); // Using bodyParser middleware to parse urlencoded request bodies

// Creating a new PostgreSQL client instance to connect to the database



const db = new Client({
    user: "kelzebra",
    host: "dpg-cohqii8l5elc73csecng-a.oregon-postgres.render.com",
    database: "books_krse",
    password: "SxBxfP1pI6hVgiPNYjCz147TsX1ZZp0M",
    port: 5432,
    ssl: {
        rejectUnauthorized: false // SSL sertifikasını doğrulamayı reddetme
    }
});

db.connect()
    .then(() => console.log('Connected to the database'))
    .catch(err => console.error('Connection error', err.stack));


// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Internal Server Error');
});

// Handling GET requests to the root endpoint
app.get("/", async (req, res) => {
    try {
        // Set default sorting criteria if sortBy parameter is not provided
        let sortBy = req.query.sortBy || 'best'; // Default sorting criteria

        // Construct the SQL query based on the sorting criteria
        let query = "SELECT books.book_title, books.isbn, books.author, books.id, scores.date_read, scores.like_score, notes.summary " +
            "FROM books JOIN scores ON books.id = scores.book_id JOIN notes ON books.id = notes.book_id ";


        // Append ORDER BY clause based on the sorting criteria
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

        // Execute the SQL query to fetch book information from the database
        const result = await db.query(query);

        // Extract information from the query result
        const information = result.rows;

        // Render the 'index.ejs' template with book information
        res.render("index.ejs", { bookItems: information });
    } catch (error) {
        // Handle errors that occur during database query execution
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


// Handling GET requests to the '/add' endpoint
app.get("/add", (req, res) => {
    try {
        res.render("add.ejs");
    } catch (error) {
        // Handle any errors that occur during the rendering process
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
    }
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
    try {
        const { book_title, isbn, author, summary, note, like_score, date_read } = req.body;

        // Validate parameters (you can implement more thorough validation as needed)
        if (!book_title || !isbn || !author || !summary || !note || !like_score || !date_read) {
            throw new Error('Missing required parameters');
        }

        // Capitalize the first letter of each word in bookTitle, isbn, and author
        const bookTitle = capitalizeEveryWord(book_title);
        const capitalizedIsbn = capitalizeEveryWord(isbn);
        const capitalizedAuthor = capitalizeEveryWord(author);

        // Insert values into respective tables
        const bookInsertResult = await db.query("INSERT INTO books(book_title, isbn, author) VALUES($1, $2, $3) RETURNING id", [bookTitle, capitalizedIsbn, capitalizedAuthor]);
        const bookId = bookInsertResult.rows[0].id;

        await db.query("INSERT INTO notes(summary, note, book_id) VALUES($1, $2, $3)", [summary, note, bookId]);
        await db.query("INSERT INTO scores(like_score, book_id, date_read) VALUES($1, $2, $3)", [like_score, bookId, date_read]);

        res.redirect("/");
    } catch (error) {
        console.error("Error:", error.message); // Log the error message for better troubleshooting
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
        const bookId = req.params.id; // Fix the parameter

        // Query the database to retrieve detailed information about a specific book
        const result = await db.query("SELECT books.book_title, books.isbn, books.author FROM books WHERE id = $1", [bookId]);
        const information = result.rows[0]; // Store the retrieved book information

        let olid = ''; // Assign a default value

        // If there is an ISBN, make the API request
        if (information && information.isbn) {
            try {
                const resultJson = await axios.get(`https://covers.openlibrary.org/b/isbn/${information.isbn}.json`);
                const data = resultJson.data; // Store the retrieved data
                olid = data.olid;
            } catch (error) {
                console.error("An error occurred during the API request:", error);
            }
        }

        // Update the database
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
    try {
        const deleteId = req.body['book-id'];

        // Delete related records from child tables first
        await db.query("DELETE FROM scores WHERE book_id = $1", [deleteId]);
        await db.query("DELETE FROM notes WHERE book_id = $1", [deleteId]);

        // Then delete the book record from the 'books' table
        await db.query("DELETE FROM books WHERE id = $1", [deleteId]);

        res.redirect("/"); // Redirect to the root page after successful deletion
    } catch (error) {
        console.error("Error deleting book:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Starting the server and listening on the specified port
app.listen(port, () => {
    console.log(`Listening on port ${port}`); // Logging a message indicating that the server is running
});


