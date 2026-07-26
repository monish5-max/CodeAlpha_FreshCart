const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./db");

const app = express();

// =======================
// Middleware
// =======================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        secret: "freshcartsecret",
        resave: false,
        saveUninitialized: false,
    })
);

// =======================
// Static Folder
// =======================

app.use(express.static("public"));

// Make logged-in user available in every EJS page
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// =======================
// View Engine
// =======================

app.set("view engine", "ejs");

// =======================
// GET Routes
// =======================

app.get("/", (req, res) => {
    res.render("home" );
});

app.get("/products", (req, res) => {

    const search = req.query.search;

    let sql = "SELECT * FROM products";
    let values = [];

    if (search) {
        sql += " WHERE product_name LIKE ?";
        values.push("%" + search + "%");
    }

    db.query(sql, values, (err, result) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        res.render("products", {
            products: result
        });

    });

});

app.get("/categories", (req, res) => {

    const sql = "SELECT * FROM categories";

    db.query(sql, (err, result) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        res.render("categories", {
            categories: result
        });

    });

});

app.get("/cart", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login");
    }

    const sql = `
        SELECT
            cart.id,
            cart.quantity,
            products.product_name,
            products.price,
            products.image
        FROM cart
        JOIN products
        ON cart.product_id = products.id
        WHERE cart.user_id = ?
    `;

    db.query(sql, [req.session.user.id], (err, result) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        let total = 0;

        result.forEach(item => {
            total += item.price * item.quantity;
        });

        res.render("cart", {
            cartItems: result,
            total: total
        });

    });

});
app.get("/checkout", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login");
    }

    const sql = `
        SELECT
            cart.id,
            cart.quantity,
            products.product_name,
            products.price,
            products.image
        FROM cart
        JOIN products
        ON cart.product_id = products.id
        WHERE cart.user_id = ?
    `;

    db.query(sql, [req.session.user.id], (err, result) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        let total = 0;

        result.forEach(item => {
            total += item.price * item.quantity;
        });

        res.render("checkout", {
            cartItems: result,
            total: total,
            user: req.session.user
        });

    });

});
app.get("/login", (req, res) => {
    res.render("login",{
        user: req.session.user
    });
});
app.get("/order-success", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login");
    }

    res.render("order-success", {
        user: req.session.user
    });

});

// =======================
// Register User
// =======================

app.post("/register", async (req, res) => {

    const { name, email, phone, password } = req.body;

    try {

        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO users (name, email, phone, password)
            VALUES (?, ?, ?, ?)
        `;

        db.query(sql, [name, email, phone, hashedPassword], (err) => {

            if (err) {

                console.log(err);

                if (err.code === "ER_DUP_ENTRY") {
                return res.send("Email already exists. Please login.");
            }

            return res.send("Registration Failed");

}
            res.redirect("/login");

        });

    } catch (error) {

        console.log(error);
        res.send("Something went wrong!");

    }

});

// =======================
// Login User
// =======================

app.post("/login", (req, res) => {

    const { email, password } = req.body;

    const sql = "SELECT * FROM users WHERE email = ?";

    db.query(sql, [email], (err, result) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        if (result.length === 0) {
            return res.send("User not found");
        }

        const user = result[0];

        bcrypt.compare(password, user.password, (err, isMatch) => {

            if (err) {
                console.log(err);
                return res.send("Login Error");
            }

            if (isMatch) {

                req.session.user = user;

                return res.redirect("/account");

            } else {

                return res.send("Incorrect Password");

            }

        });

    });

});
// Add to Cart
// =======================

app.post("/add-to-cart", (req, res) => {

    console.log("Body:", req.body);
    console.log("Session:", req.session.user);

    if (!req.session.user) {
        return res.redirect("/login");
    }

    const userId = req.session.user.id;
    const productId = req.body.product_id;

    console.log("User ID:", userId);
    console.log("Product ID:", productId);

    const sql = `
        INSERT INTO cart (user_id, product_id, quantity)
        VALUES (?, ?, ?)
    `;

    db.query(sql, [userId, productId, 1], (err, result) => {

        if (err) {
            console.log("MYSQL ERROR:", err);
            return res.send("Unable to add product.");
        }

        console.log("Inserted Successfully");
        console.log(result);

        res.redirect("/products");
    });

});
app.get("/remove-cart/:id", (req, res) => {

    const cartId = req.params.id;

    const sql = "DELETE FROM cart WHERE id = ?";

    db.query(sql, [cartId], (err) => {

        if (err) {
            console.log(err);
            return res.send("Unable to remove item.");
        }

        res.redirect("/cart");

    });

});
app.get("/increase/:id", (req, res) => {

    const cartId = req.params.id;

    const sql = `
        UPDATE cart
        SET quantity = quantity + 1
        WHERE id = ?
    `;

    db.query(sql, [cartId], (err) => {

        if (err) {
            console.log(err);
            return res.send("Unable to increase quantity.");
        }

        res.redirect("/cart");

    });

});
app.get("/decrease/:id", (req, res) => {

    const cartId = req.params.id;

    const sql = `
        UPDATE cart
        SET quantity = quantity - 1
        WHERE id = ? AND quantity > 1
    `;

    db.query(sql, [cartId], (err) => {

        if (err) {
            console.log(err);
            return res.send("Unable to decrease quantity.");
        }

        res.redirect("/cart");

    });

});
// =======================
// Place Order
// =======================

app.post("/place-order", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login");
    }

    const userId = req.session.user.id;

    const cartSql = `
        SELECT products.price, cart.quantity
        FROM cart
        JOIN products
        ON cart.product_id = products.id
        WHERE cart.user_id = ?
    `;

    db.query(cartSql, [userId], (err, cartItems) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        let total = 0;

        cartItems.forEach(item => {
            total += item.price * item.quantity;
        });

        const orderSql = `
            INSERT INTO orders (user_id, total)
            VALUES (?, ?)
        `;

        db.query(orderSql, [userId, total], (err) => {

            if (err) {
                console.log(err);
                return res.send("Unable to place order.");
            }

            const deleteSql = `
                DELETE FROM cart
                WHERE user_id = ?
            `;

            db.query(deleteSql, [userId], (err) => {

                if (err) {
                    console.log(err);
                    return res.send("Order placed, but cart not cleared.");
                }

                res.redirect("/order-success");

            });

        });

    });

});
// =======================
// Account Page
// =======================

app.get("/account", (req, res) => {

    if (!req.session.user) {

        return res.redirect("/login");

    }

    res.render("login", {
        user: req.session.user
    });

});

// =======================
// Logout
// =======================

app.get("/logout", (req, res) => {

    req.session.destroy(() => {

        res.redirect("/");

    });

});

// =======================
// Server
// =======================

app.listen(3000, () => {

    console.log("🚀 Server running on http://localhost:3000");

});