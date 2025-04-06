import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "book_notes",
  password: "umairrkhan009",
  port: 5432,
});

db.connect();

const KEY_API_URL = "https://openlibrary.org/search.json?title=";
const COVER_API_URL = "https://covers.openlibrary.org/b/id/";

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


app.get("/", async (req, res) => {
  const books = await db.query("SELECT * FROM books");
  // console.log(books.rows);
  res.render("index.ejs", {
    books: books.rows,
    url: COVER_API_URL,
  });
});

app.get("/rating", async (req, res) => {
  const books = await db.query("SELECT * FROM books ORDER BY rating DESC;");
  res.render("index.ejs", {
    books: books.rows,
    url: COVER_API_URL,
  });
});

app.get("/alphabetical", async (req, res) => {
  const books = await db.query("SELECT * FROM books ORDER BY title ASC;");
  res.render("index.ejs", {
    books: books.rows,
    url: COVER_API_URL,
  });
});

app.get("/notes/:bookID", async (req, res) => {
  const bookID = req.params.bookID;
  const bookResponse = await db.query(
    "SELECT id, title, rating FROM books WHERE id=$1",
    [bookID]
  );
  const bookResult = bookResponse.rows[0];
  const notesResponse = await db.query(
    "SELECT notes FROM notes WHERE book_id=$1",
    [bookID]
  );
  const notesResult = notesResponse.rows[0];
  res.render("notes.ejs", {
    title: bookResult.title,
    rating: bookResult.rating,
    notes: notesResult.notes,
    id: bookResult.id,
  });
});

app.get("/new", (req, res) => {
    res.render("new.ejs");

});

app.get("/edit/:id", async(req, res) => {
    const id = req.params.id;
    const bookResponse = await db.query("SELECT * FROM books WHERE id=$1;",[id]);
    const notesResponse = await db.query("SELECT notes FROM notes WHERE book_id=$1;",[id])
    res.render("new.ejs",{
        id: bookResponse.rows[0].id,
        title: bookResponse.rows[0].title,
        rating: bookResponse.rows[0].rating,
        notes: notesResponse.rows[0].notes
    })
})

app.post("/submit", async (req, res) => {
    const title = req.body.title.replace(/\s/g, "+");


    const rating = req.body.rating;
    const notes = req.body.notes || "No notes written";

    const response = await axios.get(`${KEY_API_URL}${title}`);
    console.log(response.data.docs[0]);
    const result = response.data.docs[0];
    if (result) {
    const bookTitle = result.title;
    const cover_id = result.cover_i || 0;
    const author = result.author_name.toString();

    console.log(bookTitle, cover_id, author, rating, notes);

    const bookResult = await db.query(
      "INSERT INTO books (title, cover_id, rating, author) VALUES ($1, $2, $3, $4) RETURNING id;",
      [bookTitle, cover_id, rating, author]
    );
    console.log(bookResult.rows[0].id);
    const id = bookResult.rows[0].id;
    await db.query("INSERT INTO notes (notes, book_id) VALUES ($1, $2)", [
      notes,
      id,
    ]);
    res.redirect("/");
  } else {
    console.log("No such Book found");
    res.render("new.ejs", {
      error: "No such book found. Try entering a different name",
    });
  }
});

app.post("/contact", async (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const message = req.body.message;
  await db.query(
    "INSERT INTO contact (name, email, message) VALUES ($1, $2, $3);",
    [name, email, message]
  );
  console.log(name, email, message);
  res.redirect("/");
});

app.post("/edit/:id", async (req, res) =>{
    const id = req.params.id;
    const title = req.body.title;
    const rating = req.body.rating;
    const notes = req.body.notes;

    await db.query("UPDATE books SET title = $1, rating = $2 WHERE id=$3;",[title, rating, id]);
    await db.query("UPDATE notes SET notes=$1 WHERE book_id=$2;",[notes, id]);
    res.redirect(`/notes/${id}`)
})



app.post("/delete/:id", async (req, res) => {
  const id = req.params.id;
  await db.query("DELETE FROM notes WHERE book_id=$1;", [id]);
  await db.query("DELETE FROM books WHERE id = $1;", [id]);
  res.redirect("/#books");
});

app.listen(port, () => {
  console.log(`Successfully listening on port ${port}`);
});
