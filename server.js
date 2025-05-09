const eventi_predefiniti = {
    "news": [
        { "id": 1, "title": "Primo post express", "content": "Primo post del nostro blog", "author": "Pippo", "date": "2024-10-10" },
        { "id": 2, "title": "Guida a Express.js", "content": "Express è un framework per Node.js...", "author": "Paperino", "date": "2023-10-09" },
        { "id": 3, "title": "Chi sono", "content": "Ciao sono Dozer e vendo corsi di business online!!", "author": "Dozer", "date": "2023-10-09" }
    ],
    "users": [
        { "id": 1, "username": "admin", "password": "admin123", "role": "admin" },
        { "id": 2, "username": "user", "password": "user123", "role": "user" }
    ],
    "categories": ["Sviluppo", "Tutorial", "Regolamenti"]

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
const db = new Low(adapter, { news: [], users: [], categories: [] });

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
        posts = Array.isArray(db.data.news) ? db.data.news : [];
        users = Array.isArray(db.data.users) ? db.data.users : [];
        categories = Array.isArray(db.data.categories) ? db.data.categories : [];

    } catch (err) { // Creazione del file
        console.log("File non trovato, creazione in corso...");
        db.data = eventi_predefiniti;
        await db.write(); // Scrive per creare il file
        posts = db.data.news;
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
        } else if (req.session.user) //significa che l'utente e' loggato ma non ha i permessi per accedere alla risorsa
            res.status(403).send(`Accesso negato<br><a href="/home_logged">Ritorna alla home</a>`);
        else
            res.status(403).send(`Accesso negato<br><a href="/home_page">Ritorna alla home</a>`);
    };
}

//
app.get('/', (req, res) => {
    if (req.session.user) //se e' gia' loggato passiamo la home degli utenti registrati
        res.redirect('/home_logged');
    else
        res.redirect('/home_page');

}
);

// Configura la sessione prima delle route
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));


app.get('/loginPage', (req, res) => {
    res.render('login');
});

app.get('/signupPage', (req, res) => {
    res.render('signup');
});


// Endpoint di login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        req.session.user = { username: user.username, role: user.role };
        res.redirect('/home_logged');
    } else {
        res.status(401).send('Credenziali non valide');
    }
});

// Endpoint di registrazione
app.post('/signup', async (req, res) => {
    const { username, password, password2 } = req.body;
    const user = users.find(u => u.username === username);
    if (user) { //se esistono già le credenziali
        res.status(403).send(`Utente già esistente!<br><a href="/loginPage">Effettua il login</a><br><a href="/signupPage">Registrati</a><br><a href="/home_page">Ritorna alla home</a>`);

    } else {
        if (password === password2) { //se le password inserire sono uguali, procede alla registrazione
            const newUser = {
                id: db.data.users.length + 1, // Usa db.data.posts invece di posts
                username: username,
                password: password,
                role: "user"
            };
            req.session.user = { username: newUser.username, role: newUser.role };

            db.data.users.push(newUser); // Aggiungi il nuovo user
            await db.write(); // Salva le modifiche su db.json
            res.redirect('/home_logged');
        }
    }
});


app.get('/home_page', (req, res) => {
    res.render('home_page', { posts: posts });
});

app.get('/home_logged', auth(['user', 'admin']), (req, res) => {
    console.log("user logged: " + req.session.user.username)
    res.render('home_logged', { userLogged: req.session.user.username, posts: posts });
});



// Endpoint di logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Errore nel logout');
        }
        res.redirect('/'); // Reindirizza alla home page o altra pagina
    });
});


app.get('/post/:id', (req, res) => {
    const postId = parseInt(req.params.id);
    console.log('Id richiesto:', postId);
    const post = posts.find(p => p.id === postId); //trova il post associato all'ID
    if (post) {
        console.log(post)
        if (req.session.user) //se e' loggato
            res.render('post_logged', { title: post.title, post });
        else 
            res.render('post', { title: post.title, post });
    } else {
        res.status(404).send('Post non trovato');
    }
});

//
//
// Rotte protetta accessibile solo dall'admin
app.get('/admin', auth(['admin']), (req, res) => {
    res.render('admin', { news: posts, categories: categories });
});

app.get('/datispreco', async (req, res) => {
    await fetch('http://localhost:4000/sprechi-inizio', {
        method: 'GET',
        headers: {
            'chiave': 'qwerty' // oppure 'Authorization': 'Bearer qwerty'
        }
    })
        .then(response => response.json())
        .then(dati => {
            console.log(dati);
            res.render('dati_spreco', { dati: dati });
        })
        .catch(error => {
            console.error('Errore:', error);
            res.status(500).send('Errore durante il recupero dei dati');
        });
});

app.get('/datisprecooggi', async (req, res) => {
    await fetch('http://localhost:4000/sprechi-oggi', {
        method: 'GET',
        headers: {
            'chiave': 'qwerty'
        }
    })
        .then(response => response.json())
        .then(dati => {
            console.log(dati);
            res.render('dati_spreco', { dati: dati });
        })
        .catch(error => {
            console.error('Errore:', error);
            res.status(500).send('Errore durante il recupero dei dati');
        });
});

app.get('/datitrasporto', async (req, res) => {
    const km = req.query.km || 0;
    await fetch(`http://localhost:4000/trasporto?km=${km}`, {
        method: 'GET',
        headers: {
          'chiave': 'qwerty'
        }
      })
        .then(response => response.json())
        .then(dati => {
            console.log(dati);
            res.render('dati_trasporto', { dati: dati, km: km });
        })
        .catch(error => {
            console.error('Errore:', error);
            res.status(500).send('Errore durante il recupero dei dati');
        });
});

// Aggiungi la categoria al post durante la creazione
app.post('/admin/add', auth(['admin']), async (req, res) => {
    const { title, content, author, category } = req.body;
    if (title && content && author && category) {
        const newPost = {
            id: posts.length + 1, // Usa db.data.posts invece di posts
            title: title,
            content: content,
            author: author,
            date: new Date().toISOString().split('T')[0],
            category: category
        };
        db.data.news.push(newPost); // Aggiungi il nuovo post direttamente a db.data.posts
        await db.write(); // Salva le modifiche su db.json
        res.redirect('/admin');
    } else {
        res.status(400).send('Tutti i campi sono obbligatori.');
    }
});

app.post('/admin/delete/:id', auth(['admin']), async (req, res) => {
    const postId = parseInt(req.params.id);
    db.data.news = db.data.news.filter(post => post.id !== postId); // modifica l'array nel db
    posts = db.data.news
    await db.write(); // Salva le modifiche sul db
    res.redirect('/admin');
});



//server
app.listen(port, () => {
    console.log(`Server avviato su http://localhost:${port}`);
});
