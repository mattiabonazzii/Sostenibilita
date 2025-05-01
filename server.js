const eventi_predefiniti = {
    "posts": [
        { "id": 1, "title": "Primo post express", "content": "Primo post del nostro blog", "author": "Pippo", "date": "2024-10-10", "category": "Tecnologia" },
        { "id": 2, "title": "Guida a Express.js", "content": "Express è un framework per Node.js...", "author": "Paperino", "date": "2023-10-09", "category": "Tecnologia" },
        { "id": 3, "title": "Chi sono", "content": "Ciao sono Dozer e vendo corsi di business online!!", "author": "Dozer", "date": "2023-10-09", "category": "Lavoro" }
    ],
    "users": [
        { "username": "admin", "password": "admin123", "role": "admin" },
        { "username": "user", "password": "user123", "role": "user" }
    ],
    "categories": ["Tecnologia", "Cucina", "Viaggi", "Sport", "Lavoro"]
};

// Importa i moduli richiesti
import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import path from "path";
import { join, dirname } from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const file = join(__dirname, "db.json");
const adapter = new JSONFile(file);
const db = new Low(adapter, { posts: [], users: [], categories: [] });

const app = express();
const port = 3000;

// Configura Pug come motore di template
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Middleware per il parsing delle richieste + session
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'mysecret',
    resave: false,
    saveUninitialized: true
}));


// Dati iniziali dei post del blog
let posts;
let users;
let categories;
//$$$$$
async function readOrCreateFile() {
    try {
        // Controlla se il file esiste
        await fs.access(file);
        console.log("File trovato, leggendo...");

        await db.read(); // Legge il file

        // Assegna il contenuto del file 
        posts = db.data.posts;
        users = db.data.users;
        categories = db.data.categories;

    } catch (err) { //Creazione del file
        console.log("File non trovato, creazione in corso...");
        db.data = eventi_predefiniti;
        await db.write(); // Scrive per creare il file
        posts = db.data.posts;
        users = db.data.users;
        categories = db.data.categories;
        console.log("File creato con successo");
    }
}

// funzione all'avvio
await readOrCreateFile();

//////////////////


/**
 * In base al ruolo passato, risponde se si puo' accedere alla risorsa
 * @param {} role 
 * @returns 
 */
function auth(role) {
    return (req, res, next) => {
        if (req.session.user && (role.includes(req.session.user.role))) {
            return next();
        }
        res.status(403).send(`Accesso negato<br><a href="/">Home</a>`);
    };
}

//
// Genera il form
app.get('/', (req, res) => {
    res.render('login');

}
);

// Endpoint di login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        req.session.user = { username: user.username, role: user.role };
        res.redirect('/home');
    } else {
        res.status(401).send('Credenziali non valide');
    }
});

// Endpoint di logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.send(`Logout effettuato<br><a href="/">Torna al Login</a>`);
});

//Index (homepage con i post)
app.get('/home', auth(['user', 'admin']), (req, res) => {
    const selectedCategory = req.query.category; //richiede la categoria
    let filteredPosts = posts;

    if (selectedCategory) {
        filteredPosts = posts.filter(post => post.category === selectedCategory); //controllo sull'atributo categoria dell'oggetto
    }

    res.render('index', { title: 'Home', posts: filteredPosts, categories });
});

app.get('/post/:id', auth(['user', 'admin']), (req, res) => {
    const postId = parseInt(req.params.id);
    console.log('Id richiesto:', postId);
    const post = posts.find(p => p.id === postId); //trova il post associato all'ID
    if (post) {
        console.log(post)
        res.render('post', { title: post.title, post });
    } else {
        res.status(404).send('Post non trovato');
    }
});

//
//
// Rotte protetta accessibile solo dall'admin
app.get('/admin', auth(['admin']), (req, res) => {
    res.render('admin', { categories: categories, posts: posts });
});


// Aggiungi la categoria al post durante la creazione
app.post('/admin/add', auth(['admin']), async (req, res) => {
    const { title, content, author, category } = req.body;
    if (title && content && author && category) {
        const newPost = {
            id: db.data.posts.length + 1, // Usa db.data.posts invece di posts
            title,
            content,
            author,
            date: new Date().toISOString().split('T')[0],
            category
        };
        db.data.posts.push(newPost); // Aggiungi il nuovo post direttamente a db.data.posts
        await db.write(); // Salva le modifiche su db.json
        res.redirect('/admin');
    } else {
        res.status(400).send('Tutti i campi sono obbligatori.');
    }
});

app.post('/admin/delete/:id', auth(['admin']), async (req, res) => {
    const postId = parseInt(req.params.id);
    db.data.posts = db.data.posts.filter(post => post.id !== postId); // modifica l'array nel db
    posts = db.data.posts
    await db.write(); // Salva le modifiche sul db
    res.redirect('/admin');
});



//server
app.listen(port, () => {
    console.log(`Server avviato su http://localhost:${port}`);
});
