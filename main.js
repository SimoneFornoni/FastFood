const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const { MongoClient, ObjectId, Timestamp } = require('mongodb');
const swaggerDocument = require('./swagger.json');

const mongoURL = process.env.MONGO_URI
const port = 3005;
const client = new MongoClient(mongoURL);
const app = express()

app.use(express.json());
app.use(cors());
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Function to start the server and connect to MongoDB.
async function startServer() {
    try {
        await client.connect();

        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (err) {
        console.error('Failed to connect to MongoDB or start server:', err);
        process.exit(1);
    }
}

startServer();

// On node server shutdown, close the MongoDB connection.
process.on('SIGINT', async () => {
    console.log('Server shutting down. Closing MongoDB connection...');
    if (client) {
        await client.close();
        console.log('MongoDB connection closed.');
    }
    process.exit(0);
});

// -- Authentication Routes

// Login Route
// - This route handles user login for both customers and restaurateurs.
// - It checks the provided email and password against both collections and returns the user data if successful.
// - If the user is found, it returns a success message with the user's ID, role, and username.'
// - If the user is not found, it returns an error message.
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password ) {
            return res.status(400).json({ error: "Email e password sono obbligatori" });
        }
        
        const filter = { email: email, password: password };

        let user = await client
            .db('FastFood')
            .collection('customers')
            .findOne({...filter, deleteDate: null});
    
        let role = 'customer';
        
        if (!user) {
            user = await client
                .db('FastFood')
                .collection('restaurateurs')
                .findOne(filter);

            role = 'restaurateur';
        }

        if (user) {
            userData = {
                _id: user._id,
                role: role,
                username: user.name + " " + user.lastName,
            };

            if (role === 'customer') {
                userData.preference = user.preference;
            }

            res.status(200).json({ message: "Login effettuato con successo", user: userData });
        } else {
            res.status(401).json({ error: "Credenziali errate" });
        }
    } catch (error) {
        res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// ---- Restaurateur Routes

// Create Restaurateur Route
// - This route handles the creation of a new restaurateur.
// - It validates the input fields and checks if the email is already in use by either a customer or another restaurateur.
// - If the validation passes, it inserts the new restaurateur into the database, returning a success message with the inserted ID.
// - If any validation fails or if the email is already in use, it returns an error message.
app.post('/restaurateurs', async (req, res) => {
    const { name, lastName, email, password, phone, pIva } = req.body;

    if (name.length < 2 || !/^[a-zA-Z]+$/.test(name)) {
        return res.status(400).json({ error: "Nome troppo corto o contiene caratteri non validi" });
    }

    if (lastName.length < 2 || !/^[a-zA-Z]+$/.test(lastName)) {
        return res.status(400).json({ error: "Cognome troppo corto o contiene caratteri non validi" });
    }

    if (email.length < 5 || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        return res.status(400).json({ error: "Email non valida"  });
    }

    if (password.length < 2) {
        return res.status(400).json({ error: "Password non valida"  });
    }

    if (!/^[0-9]{10}$/.test(phone)) {
        return res.status(400).json({ error: "Telefono non valido"  });
    }

    if (!/^[0-9]{11}$/.test(pIva)) {
        return res.status(400).json({ error: "P.IVA non valida"  });
    }

    try {

        const restaurateur = {
            name: name,
            lastName: lastName,
            email: email,
            password: password,
            phone: phone,
            pIva: pIva,
        };

        const existingCustomer = await client
            .db('FastFood')
            .collection('customers')
            .findOne({ email: email});

        const existingRestaurateur = await client
            .db('FastFood')
            .collection('restaurateurs')
            .findOne({ email: email});

        if (existingCustomer || existingRestaurateur) {
            return res.status(409).json({ error: "Email già in uso" });
        }

        const result = await client.db('FastFood')
            .collection('restaurateurs')
            .insertOne(restaurateur);

        if (result.insertedId) {
            res.status(201).json({message: "Ristoratore creato con successo", insertedId: result.insertedId});
        } else {
            res.status(400).json({ error: "Errore nella creazione del ristoratore" });
        }
    } catch (error) {
        return res.status(500).json({ error: `Errore non gestito: ${error.message} `});
    }
});

// Get Restaurateur Route
// - This route retrieves a restaurateur's details by their ID.
// - If the ID is valid, it queries the database for the restaurateur.
// - If found, it returns the restaurateur's details with a success message.
// - If not found, it returns an error message.
app.get('/restaurateurs/:id', async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID non valido" });
    }

    try {
        const filter = { _id: new ObjectId(id) };
        const restaurateur = await client
            .db('FastFood')
            .collection('restaurateurs')
            .findOne(filter);

        if (restaurateur) {
            res.status(200).json({ message: "Ristoratore trovato", restaurateur: restaurateur });
        } else {
            res.status(404).json({ error: "Ristoratore non trovato" });
        }
    } catch (error) {
        return res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Update Restaurateur Route
// - This route updates a restaurateur's profile by their ID.
// - If the ID is valid and at least one field provided is valid for update, it updates the restaurateur's details in the database.
// - If the update is successful, it returns a success message.
// - If the ID is invalid or no fields provided is valid for update, it returns an error message.
app.put('/restaurateurs/:id', async (req, res) => {
    const id = req.params.id;
    const { name, lastName, email, password, phone, pIva } = req.body;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID non valido" });
    }

    try {
        const updateFields = {};

        if (name) {
            if (name.length < 2 || !/^[a-zA-Z]+$/.test(name)) {
                return res.status(400).json({ error: "Nome troppo corto o contiene caratteri non validi" });
            }
            updateFields.name = name;
        }

        if (lastName) {
            if (lastName.length < 2 || !/^[a-zA-Z]+$/.test(lastName)) {
                return res.status(400).json({ error: "Cognome troppo corto o contiene caratteri non validi" });
            }
            updateFields.lastName = lastName;
        }

        if (email) {
            if (email.length < 5 || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
                return res.status(400).json({ error: "Email non valida" });
            }

            const existingRestaurateur = await client
                .db('FastFood')
                .collection('restaurateurs')
                .findOne({ email: email, _id: { $ne: new ObjectId(id) } });
            const existingCustomer = await client
                .db('FastFood') 
                .collection('customers')
                .findOne({ email: email, _id: { $ne: new ObjectId(id) } });

            if (existingRestaurateur || existingCustomer) {
                return res.status(409).json({ error: "Email già in uso" });
            }

            updateFields.email = email;
        }

        if (password) {
            if (password.length < 2) {
                return res.status(400).json({ error: "Password non valida" });
            }
            updateFields.password = password;
        }

        if (phone) {
            if (!/^[0-9]{10}$/.test(phone)) {
                return res.status(400).json({ error: "Telefono non valido" });
            }
            updateFields.phone = phone;
        }

        if (pIva) {
            if (!/^[0-9]{11}$/.test(pIva)) {
                return res.status(400).json({ error: "P.IVA non valida" });
            }
            updateFields.pIva = pIva;
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ error: "Almeno un campo deve essere aggiornato" });
        }

        const filter = { _id: new ObjectId(id) };
        const result = await client
            .db('FastFood')
            .collection('restaurateurs')
            .updateOne(filter, { $set: updateFields });

        if (result.modifiedCount > 0) {
            res.status(200).json({ message: "Profilo ristoratore aggiornato con successo" });
        } else {
            res.status(404).json({ error: "Ristoratore non trovato" });
        }
    } catch (error) {
        return res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Delete Restaurateur Route
// - This route deletes a restaurateur by their ID.
// - If the ID is valid, it attempts to delete the restaurateur from the database.
// - If the deletion is successful, it returns a success message.
// - If the restaurateur has an associated restaurant, it returns an error message.
// - If the ID is invalid or the restaurateur is not found, it returns an error message.
app.delete('/restaurateurs/:id', async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID non valido" });
    }

    let resData = {};

    try {
        const existingRestaurant = await client
            .db('FastFood')
            .collection('restaurants')
            .findOne({ owner: new ObjectId(id), deleteDate: null });

        if (existingRestaurant) {
            const restaurantId = existingRestaurant._id;

            const menuFilter = { restaurantId: new ObjectId(restaurantId) };
            const menuItems = await client
                .db('FastFood')
                .collection('menus')
                .find(menuFilter)
                .toArray();

            const mealIds = menuItems.map(item => item.mealId);

            if (mealIds.length > 0) {
                const specialtyMealsResult = await client
                    .db('FastFood')
                    .collection('meals')
                    .updateMany({
                        _id: { $in: mealIds },
                        isSpecialty: true,
                        deleteDate: null
                    }, { 
                        $set: { deleteDate: new Date() } 
                    });
                resData.deletedSpecialtyMeals = specialtyMealsResult.modifiedCount;
            }

            const menuResult = await client
                .db('FastFood')
                .collection('menus')
                .deleteMany(menuFilter);

            resData.deletedMenuItems = menuResult.deletedCount;

            const restaurantFilter = { _id: new ObjectId(restaurantId), deleteDate: null };
            const restaurantResult = await client
                .db('FastFood')
                .collection('restaurants')
                .updateOne(restaurantFilter, { $set: { deleteDate: new Date() } });

            if (restaurantResult.modifiedCount <= 0) {
                return res.status(404).json({ error: "Ristorante non trovato" });
            }
        }

        const filter = { _id: new ObjectId(id) };
        const result = await client
            .db('FastFood')
            .collection('restaurateurs')
            .deleteOne(filter);

        if (result.deletedCount > 0) {
            res.status(200).json({
                message: "Ristoratore eliminato con successo",
                deletedRestaurant: existingRestaurant ? true : false,
                ...resData
            });
        } else {
            res.status(404).json({ error: "Ristoratore non trovato" });
        }
    } catch (error) {
        res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// ---- Customer Routes

// Create Customer Route
// - This route handles the creation of a new customer.
// - It validates the input fields and checks if the email is already in use by either a customer or a restaurateur.
// - If the validation passes, it inserts the new customer into the database, returning a success message with the inserted ID.
// - If any validation fails or if the email is already in use, it returns an error message.
app.post('/customers', async (req, res) => {
    const { name, lastName, email, password, paymentMethod, preference } = req.body;

    if (name.length < 2 || !/^[a-zA-Z]+$/.test(name)) {
        return res.status(400).json({ error: "Nome troppo corto o contiene caratteri non validi" });
    }

    if (lastName.length < 2 || !/^[a-zA-Z]+$/.test(lastName)) {
        return res.status(400).json({ error: "Cognome troppo corto o contiene caratteri non validi" });
    }

    if (email.length < 5 || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        return res.status(400).json({ error: "Email non valida" });
    }

    if (paymentMethod !== "creditCard" && paymentMethod !== "prepaidCard" && paymentMethod !== "paypal" && paymentMethod !== "cash") {
        return res.status(400).json({ error: "Metodo di pagamento non valido" });
    }

    if (['first', 'second', 'dessert'].includes(preference) === false) {
        return res.status(400).json({ error: "Preferenza non valida" });
    }

    if (password.length < 2) {
        return res.status(400).json({ error: "Password non valida" });
    }

    if (!paymentMethod) {
        return res.status(400).json({ error: "Metodo di pagamento non selezionato" });
    }

    if (!preference) {
        return res.status(400).json({ error: "Preferenza non selezionata" });
    }

    try {
        const customer = {
            name: name,
            lastName: lastName,
            email: email,
            password: password,
            paymentMethod: paymentMethod,
            preference: preference,
            deleteDate: null
        };

        const existingCustomer = await client
            .db('FastFood')
            .collection('customers')
            .findOne({ email: email});

        const existingRestaurateur = await client
            .db('FastFood')
            .collection('restaurateurs')
            .findOne({ email: email});

        if (existingCustomer || existingRestaurateur) {
            return res.status(409).json({ error: "Email già in uso" });
        }

        const result = await client.db('FastFood')
            .collection('customers')
            .insertOne(customer);

        if (result.insertedId) {
            res.status(201).json({ message: "Cliente creato con successo", insertedId: result.insertedId });
        } else {
            res.status(400).json({ error: "Errore nella creazione del cliente" });
        }
    } catch (error) {
        return res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Get Customer Route
// - This route retrieves a customer's details by their ID.
// - If the ID is valid, it queries the database for the customer.
// - If found, it returns the customer's details with a success message.
// - If not found, it returns an error message.
app.get('/customers/:id', async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID non valido" });
    }

    try {
        const filter = { _id: new ObjectId(id), deleteDate: null };
        const customer = await client
            .db('FastFood')
            .collection('customers')
            .findOne(filter);

        if (customer) {
            res.status(200).json({ message: "Cliente trovato", customer: customer });
        } else {
            res.status(404).json({ error: "Cliente non trovato" });
        }
    } catch (error) {
        return res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Update Customer Route
// - This route updates a customer's profile by their ID.
// - If the ID is valid and at least one field provided is valid for update, it updates the customer's details in the database.
// - If the update is successful, it returns a success message.
// - If the ID is invalid or no fields provided is valid for update, it returns an error message.
app.put('/customers/:id', async (req, res) => {
    const id = req.params.id;
    const { name, lastName, email, password, paymentMethod, preference } = req.body;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID non valido" });
    }

    try {
        const updateFields = {};

        if (name) {
            if (name.length < 2 || !/^[a-zA-Z]+$/.test(name)) {
                return res.status(400).json({ error: "Nome troppo corto o contiene caratteri non validi" });
            }
            updateFields.name = name;
        }

        if (lastName) {
            if (lastName.length < 2 || !/^[a-zA-Z]+$/.test(lastName)) {
                return res.status(400).json({ error: "Cognome troppo corto o contiene caratteri non validi" });
            }
            updateFields.lastName = lastName;
        }

        if (email) {
            if (email.length < 5 || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
                return res.status(400).json({ error: "Email non valida" });
            }

            const existingCustomer = await client
                .db('FastFood')
                .collection('customers')
                .findOne({ email: email, _id: { $ne: new ObjectId(id) } });

            const existingRestaurateur = await client
                .db('FastFood')
                .collection('restaurateurs')
                .findOne({ email: email, _id: { $ne: new ObjectId(id) } });

            if (existingCustomer || existingRestaurateur) {
                return res.status(409).json({ error: "Email già in uso" });
            }

            updateFields.email = email;
        }

        if (password) {
            if (password.length < 2) {
                return res.status(400).json({ error: "Password non valida" });
            }
            updateFields.password = password;
        }

        if (paymentMethod) {
            if (paymentMethod !== "creditCard" && paymentMethod !== "prepaidCard" && paymentMethod !== "paypal" && paymentMethod !== "cash") {
                return res.status(400).json({ error: "Metodo di pagamento non valido" });
            }
            updateFields.paymentMethod = paymentMethod;
        }

        if (preference) {
            if (['first', 'second', 'dessert'].includes(preference) === false) {
                return res.status(400).json({ error: "Preferenza non valida" });
            }
            updateFields.preference = preference;
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ error: "Almeno un campo deve essere aggiornato" });
        }

        const filter = { _id: new ObjectId(id), deleteDate: null };
        const result = await client
            .db('FastFood')
            .collection('customers')
            .updateOne(filter, { $set: updateFields });

        if (result.modifiedCount > 0) {
            res.status(200).json({ message: "Profilo aggiornato con successo" });
        } else {
            res.status(404).json({ error: "Cliente non trovato o nessun campo aggiornato" });
        }
    } catch (error) {
        return res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Delete Customer Route
// - This route logically deletes a customer by their ID.
// - If the ID is valid, it attempts to delete the customer from the database.
// - If the deletion is successful, it returns a success message.
// - If the ID is invalid or the customer is not found, it returns an error message.
app.delete('/customers/:id', async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID non valido" });
    }

    try {
        const filter = { _id: new ObjectId(id), deleteDate: null };
        const result = await client
            .db('FastFood')
            .collection('customers')
            .updateOne(filter, { $set: { deleteDate: new Date() } });

        if (result.modifiedCount > 0) {
            res.status(200).json({ message: "Cliente eliminato con successo" });
        } else {
            res.status(404).json({ error: "Cliente non trovato" });
        }
    } catch (error) {
        return res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// ---- Restaurant Routes

// Create Restaurant Route
// - This route handles the creation of a new restaurant.
// - It validates the input fields and checks if the restaurateur exists and does not already have a restaurant.
// - If the validation passes, it inserts the new restaurant into the database, returning a success message with the inserted ID.
// - If any validation fails or if the restaurateur does not exist or already has a restaurant, it returns an error message.
app.post('/restaurants', async (req, res) => {
    const { owner, name, street, streetNumber, city, cap, phone, description, openingTime, closingTime } = req.body;

    if (!ObjectId.isValid(owner)) {
        return res.status(400).json({ error: "ID ristoratore non valido" });
    }

    if (!owner || !name || !street || !streetNumber || !city || !cap || !phone) {
        return res.status(400).json({ error: "Compilare tutti i campi obbligatori" });
    }

    if (name.length < 2 || !/^[a-zA-Z0-9\s]+$/.test(name)) {
        return res.status(400).json({ error: "Nome ristorante non valido" });
    }

    if (street.length < 2 || !/^[A-Za-z\s\.\']+$/.test(street)) {
        return res.status(400).json({ error: "Via non valida" });
    }

    if (!/^\d{1,3}[A-Za-z]?$/.test(streetNumber)) {
        return res.status(400).json({ error: "Numero civico non valido" });
    }

    if (city.length < 2 || !/^[A-Za-z\s]+$/.test(city)) {
        return res.status(400).json({ error: "Città non valida" });
    }

    if (!/^\d{5}$/.test(cap)) {
        return res.status(400).json({ error: "CAP non valido" });
    }

    if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({ error: "Telefono non valido" });
    }

    try {
        const existingRestaurateur = await client
            .db('FastFood')
            .collection('restaurateurs')
            .findOne({ _id: new ObjectId(owner) });

        if (!existingRestaurateur) {
            return res.status(404).json({ error: "Ristoratore non trovato" });
        }

        const hasRestaurant = await client
            .db('FastFood')
            .collection('restaurants')
            .findOne({ owner: new ObjectId(owner) , deleteDate: null });

        if (hasRestaurant) {
            return res.status(409).json({ error: "Il ristoratore ha già un ristorante" });
        }

        const restaurant = {
            owner: new ObjectId(owner),
            name: name,
            address: `${street} ${streetNumber}, ${city} (${cap})`,
            phone: phone,
            description: description,
            openingTime: openingTime,
            closingTime: closingTime,
            deleteDate: null
        };

        const result = await client.db('FastFood')
            .collection('restaurants')
            .insertOne(restaurant);

        if (result.insertedId) {
            res.status(201).json({ message: "Ristorante creato con successo", insertedId: result.insertedId });
        } else {
            res.status(400).json({ error: "Errore nella creazione del ristorante" });
        }
    } catch (error) {
        return res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Get Restaurant by ID Route
// - This route retrieves a restaurant's details by its ID.
// - It checks if the ID is valid and retrieves the restaurant from the database.
// - If the restaurant is found, it returns the restaurant's details with a success message.
// - If the ID is invalid or the restaurant is not found, it returns an error message
app.get('/restaurants/:id', async (req, res) => {
    try {
        const restaurantId = req.params.id;
        
        if (!ObjectId.isValid(restaurantId)) {
            return res.status(400).json({ error: 'ID ristorante non valido' });
        }

        const restaurant = await client
            .db('FastFood')
            .collection('restaurants')
            .findOne({ 
                _id: new ObjectId(restaurantId), 
                deleteDate: null 
            });
        
        if (!restaurant) {
            return res.status(404).json({ error: 'Ristorante non trovato' });
        }

        res.status(200).json({ message: 'Ristorante recuperato con successo', restaurant: restaurant });
    } catch (error) {
        return res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Get Restaurants by Owner ID Route
// - This route retrieves a restaurant by its owner's ID.
// - It checks if the owner ID is valid and retrieves the restaurant from the database.
// - If the restaurant is found, it returns the restaurant's details with a success message.
// - If the owner ID is invalid or the restaurant is not found, it returns an error
app.get('/restaurants/owner/:ownerId', async (req, res) => {
    try {
        const ownerId = req.params.ownerId;
        
        if (!ObjectId.isValid(ownerId)) {
            return res.status(400).json({ error: 'ID proprietario non valido' });
        }

        const restaurant = await client
            .db('FastFood')
            .collection('restaurants')
            .findOne({ 
                owner: new ObjectId(ownerId),
                deleteDate: null 
            });
        
        if (!restaurant ) {
            return res.status(404).json({ error: 'Nessun ristorante trovato per questo proprietario' });
        }

        res.status(200).json({ message: 'Ristorante recuperato con successo', restaurant: restaurant });
    } catch (error) {
        return res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Get Restaurants Route
// - This route retrieves all restaurants with optional search and discount information
// - ?search=term - search restaurants by name/address
// - ?preference=category - include discount information for preferred category
// - Returns all restaurants with optional filtering and discount info
app.get('/restaurants', async (req, res) => {
    try {
        const { search, preference } = req.query;
        let filter = { deleteDate: null };

        if (search) {
            filter.$or = [
                { name: { $regex: new RegExp(`^${search}`, 'i') } },
                { address: { $regex: new RegExp(`, ${search}`, 'i') } }
            ];
        }

        const restaurants = await client
            .db('FastFood')
            .collection('restaurants')
            .find(filter)
            .toArray();

        if (preference && restaurants.length > 0) {
            for (let restaurant of restaurants) {
                const menuItems = await client
                    .db('FastFood')
                    .collection('menus')
                    .find({ restaurantId: restaurant._id })
                    .toArray();

                if (menuItems.length > 0) {
                    const mealIds = menuItems.map(item => item.mealId);
                    const meals = await client
                        .db('FastFood')
                        .collection('meals')
                        .find({ 
                            _id: { $in: mealIds }, 
                            category: preference,
                            deleteDate: null 
                        })
                        .toArray();

                    restaurant.hasPreferredDiscount = menuItems.some(menuItem => {
                        const meal = meals.find(m => m._id.toString() === menuItem.mealId.toString());
                        return meal && menuItem.discount && menuItem.discount > 0;
                    });
                } else {
                    restaurant.hasPreferredDiscount = false;
                }
            }
        }

        res.status(200).json({ message: 'Ristoranti recuperati con successo', restaurants: restaurants });
    } catch (error) {
        return res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Get Restaurant Stats Route
// - This route retrieves statistics for a restaurant by its ID.
// - It checks if the ID is valid and retrieves the restaurant's orders.
// - It calculates total orders, total revenue, and pending orders.
// - If the ID is invalid or the restaurant is not found, it returns an error message.
app.get('/restaurants/:id/stats', async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID ristorante non valido" });
    }

    try {
        const restaurant = await client
            .db('FastFood')
            .collection('restaurants')
            .findOne({ _id: new ObjectId(id), deleteDate: null });

        if (!restaurant) {
            return res.status(404).json({ error: "Ristorante non trovato" });
        }

        const orders = await client
            .db('FastFood')
            .collection('orders')
            .find({ restaurantId: new ObjectId(id) })
            .toArray();

        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((total, order) => total + order.totalPrice, 0);
        const pendingOrders = orders.filter(order => order.status === 'ordered' || order.status === 'in_progress');
        const waitingTime = pendingOrders.reduce((total, order) => total + order.prepTime, 0);
        
        res.status(200).json({
            message: "Statistiche ristorante recuperate con successo",
            stats: {
                totalOrders: totalOrders,
                totalRevenue: totalRevenue,
                pendingOrders: pendingOrders.length,
                waitingTime: waitingTime
            }
        });
    } catch (error) {
        return res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Update Restaurant Route
// - This route updates a restaurant's details by its ID.
// - It checks if the ID is valid and if at least one field provided is valid for update.
// - The adress is treated as an atomic field, meaning every part of the address must be provided.
// - If the update is successful, it returns a success message.
// - If the ID is invalid or no fields provided is valid for update, it returns an error message.
app.put('/restaurants/:id', async (req, res) => {
    const id = req.params.id;
    const { name, street, streetNumber, city, cap, phone, description, openingTime, closingTime } = req.body;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID non valido" });
    }

    try {
        const updateFields = {};

        if (name) {
            if (name.length < 2 || !/^[a-zA-Z0-9\s]+$/.test(name)) {
                return res.status(400).json({ error: "Nome ristorante non valido" });
            }
            updateFields.name = name;
        }

        if (street && streetNumber && city && cap) {
            if (street.length < 2 || !/^[A-Za-z\s\.\']+$/.test(street)) {
                return res.status(400).json({ error: "Via non valida" });
            }

            if (!/^\d{1,3}[A-Za-z]?$/.test(streetNumber)) {
                return res.status(400).json({ error: "Numero civico non valido" });
            }

            if (city.length < 2 || !/^[A-Za-z\s]+$/.test(city)) {
                return res.status(400).json({ error: "Città non valida" });
            }

            if (!/^\d{5}$/.test(cap)) {
                return res.status(400).json({ error: "CAP non valido" });
            }

            updateFields.address = `${street} ${streetNumber}, ${city} (${cap})`;
        }

        if (phone) {
            if (!/^\d{10}$/.test(phone)) {
                return res.status(400).json({ error: "Telefono non valido" });
            }
            updateFields.phone = phone;
        }

        if (description) {
            updateFields.description = description;
        }

        if (openingTime) {
            updateFields.openingTime = openingTime;
        }

        if (closingTime) {
            updateFields.closingTime = closingTime;
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ error: "Nessun campo da aggiornare" });
        }

        const filter = { _id: new ObjectId(id), deleteDate: null };
        const result = await client
            .db('FastFood')
            .collection('restaurants')
            .updateOne(filter, { $set: updateFields });
        
        if (result.modifiedCount > 0) {
            res.status(200).json({ message: "Ristorante aggiornato con successo" });
        } else {
            res.status(404).json({ error: "Ristorante non trovato" });
        }
    } catch (error) {
        return res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Delete Restaurant Route
// - This route logically deletes a restaurant by its ID.
// - It checks if the ID is valid and attempts to delete the restaurant from the database.
// - If the deletion is successful, it returns a success message with the number of deleted menu items and specialty meals.
// - If the ID is invalid or the restaurant is not found, it returns an error message.
app.delete('/restaurants/:id', async (req, res) => {
    const id = req.params.id;

    console.log(`Deleting restaurant with ID: ${id}`);

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID non valido" });
    }

    try {
        const menuFilter = { restaurantId: new ObjectId(id) };
        const menuItems = await client
            .db('FastFood')
            .collection('menus')
            .find(menuFilter)
            .toArray();

        console.log("Menu items found:", menuItems);

        const mealIds = menuItems.map(item => item.mealId);

        console.log("Meal IDs to delete:", mealIds);

        let deletedSpecialtyMeals = 0;
        if (mealIds.length > 0) {
            const specialtyMealsResult = await client
                .db('FastFood')
                .collection('meals')
                .updateMany({
                    _id: { $in: mealIds },
                    isSpecialty: true,
                    deleteDate: null
                }, { 
                    $set: { deleteDate: new Date() } 
                });
            console.log("Specialty meals update result:", specialtyMealsResult);
            deletedSpecialtyMeals = specialtyMealsResult.modifiedCount;
            console.log("Specialty meals deleted:", deletedSpecialtyMeals);
        }

        const menuResult = await client
            .db('FastFood')
            .collection('menus')
            .deleteMany(menuFilter);

        console.log("Menu items deleted:", menuResult);

        const restaurantFilter = { _id: new ObjectId(id), deleteDate: null };
        const restaurantResult = await client
            .db('FastFood')
            .collection('restaurants')
            .updateOne(restaurantFilter, { $set: { deleteDate: new Date() } });

        console.log("Restaurant update result:", restaurantResult);

        if (restaurantResult.modifiedCount > 0) {
            res.status(200).json({
                message: "Ristorante eliminato con successo",
                deletedMenuItems: menuResult.deletedCount,
                deletedSpecialtyMeals: deletedSpecialtyMeals
            });
        } else {
            res.status(404).json({ error: "Ristorante non trovato" });
        }
    } catch (error) {
        return res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// ---- Restaurant Menu routes

// Add Meal to Restaurant Menu Route
// - This route adds a meal to a restaurant's menu.
// - It checks if the restaurant ID and meal ID are valid and if the price is greater than zero.
// - It checks if the restaurant and meal exist in the database.
// - If the meal is not already present in the restaurant's menu, it inserts the meal into the menu collection.
// - If the insertion is successful, it returns a success message with the inserted ID.
// - If the meal is already present in the restaurant's menu, it returns an error.
app.post('/restaurants/:id/menu', async (req, res) => {
    const id = req.params.id;
    const { meal, price } = req.body;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID ristorante non valido" });
    }

    if (!ObjectId.isValid(meal)) {
        return res.status(400).json({ error: "ID piatto non valido" });
    }

    if (price <= 0) {
        return res.status(400).json({ error: "Il prezzo deve essere maggiore di zero" });
    }

    try {
        const existingRestaurant = await client
            .db('FastFood')
            .collection('restaurants')
            .findOne({ _id: new ObjectId(id), deleteDate: null });

        if (!existingRestaurant) {
            return res.status(404).json({ error: "Ristorante non trovato" });
        }

        const existingMeal = await client
            .db('FastFood')
            .collection('meals')
            .findOne({ _id: new ObjectId(meal), deleteDate: null });
        
        if (!existingMeal) {
            return res.status(404).json({ error: "Piatto non trovato" });
        }

        const filter = { mealId: new ObjectId(meal), restaurantId: new ObjectId(id) };
        const existingMenuItem = await client
            .db('FastFood')
            .collection('menus')
            .findOne(filter);

        if (existingMenuItem) {
            return res.status(409).json({ error: "Il piatto é già presente nel menu del ristorante" });
        }

        const menuItem = {
            restaurantId: new ObjectId(id),
            mealId: new ObjectId(meal),
            price: price,
            discount: null,
        };

        const result = await client
            .db('FastFood')
            .collection('menus')
            .insertOne(menuItem);

        if (result.insertedId) {
            res.status(201).json({ message: "Piatto aggiunto al menu del ristorante con successo", insertedId: result.insertedId });
        } else {
            res.status(400).json({ error: "Errore nell'aggiunta del piatto al menu del ristorante" });
        }
    } catch (error) {
        res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Get Restaurant Menu Route
// - This route retrieves the menu of a restaurant by its ID.
// - It checks if the ID is valid and queries the database for the menu items associated with the restaurant.
// - It checks if the restaurant exists.
// - If the menu is found, it retrieves the details of each meal in the menu and returns the menu with meal details and a success message.
// - If the ID is invalid or the menu is not found, it returns an error message
app.get('/restaurants/:id/menu', async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID non valido" });
    }

    try {
        const existingRestaurant = await client
            .db('FastFood')
            .collection('restaurants')
            .findOne({ _id: new ObjectId(id), deleteDate: null });

        if (!existingRestaurant) {
            return res.status(404).json({ error: "Ristorante non trovato" });
        }

        let filter = { restaurantId: new ObjectId(id) };
        const menu = await client
            .db('FastFood')
            .collection('menus')
            .find(filter)
            .toArray();

        const mealIds = menu.map(item => item.mealId);
        
        const meals = await client
            .db('FastFood')
            .collection('meals')
            .find({ _id: { $in: mealIds.map(id => new ObjectId(id)) }, deleteDate: null })
            .toArray();

        menu.forEach(item => {
            const meal = meals.find(m => m._id.toString() === item.mealId.toString());
            if (meal) {
                item.mealDetails = meal;
            } else {
                item.mealDetails = null;
            }
        });

        res.status(200).json({ message: "Menu del ristorante trovato", menu: menu });
    } catch (error) {
        res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Update Menu Item Route
// - This route updates the price of a menu item by its restaurant ID and meal ID.
// - It checks if the restaurant ID and meal ID are valid.
// - It checks if at least one field provided is valid for update.
// - If the restaurant and meal exist, it updates the price of the menu item in the database.
// - If the IDs are invalid or the menu item is not found, it returns an error message.
app.put('/restaurants/:restaurantId/menu/:mealId', async (req, res) => {
    const restaurantId = req.params.restaurantId;
    const mealId = req.params.mealId;
    const { price, discount } = req.body;

    if (!ObjectId.isValid(restaurantId) || !ObjectId.isValid(mealId)) {
        return res.status(400).json({ error: "ID non valido" });
    }

    if (price && price <= 0) {
        return res.status(400).json({ error: "Il prezzo deve essere maggiore di zero" });
    }

    if (discount !== undefined && (discount < 0 || discount >= 100)) {
        return res.status(400).json({ error: "Lo sconto deve essere tra 0 e 99" });
    }

    try {
        const existingRestaurant = await client
            .db('FastFood')
            .collection('restaurants')
            .findOne({ _id: new ObjectId(restaurantId), deleteDate: null });

        if (!existingRestaurant) {
            return res.status(404).json({ error: "Ristorante non trovato" });
        }

        const existingMeal = await client
            .db('FastFood')
            .collection('meals')
            .findOne({ _id: new ObjectId(mealId), deleteDate: null });

        if (!existingMeal) {
            return res.status(404).json({ error: "Piatto non trovato" });
        }

        const filter = { restaurantId: new ObjectId(restaurantId), mealId: new ObjectId(mealId) };
        let updateFieldsMenu = {};

        if (price) updateFieldsMenu.price = price;
        if (discount !== undefined) updateFieldsMenu.discount = discount;

        const result = await client
            .db('FastFood')
            .collection('menus')
            .updateOne(filter, { $set: updateFieldsMenu });

        if (result.modifiedCount === 1) {
            res.status(200).json({ message: "Elemento del menu aggiornato con successo" });
        } else {
            res.status(404).json({ error: "Elemento del menu non trovato" });
        }

    } catch (error) {
        res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Delete Menu Item Route
// - This route deletes a menu item by its restaurant ID and meal ID.
// - It checks if the restaurant ID and meal ID are valid.
// - If the restaurant and meal exist, it deletes the menu item from the database.
// - If the IDs are invalid or the menu item is not found, it returns an error message.
app.delete('/restaurants/:restaurantId/menu/:mealId', async (req, res) => {
    const restaurantId = req.params.restaurantId;
    const mealId = req.params.mealId;

    if (!ObjectId.isValid(restaurantId)) {
        return res.status(400).json({ error: "ID ristorante non valido" });
    }

    if (!ObjectId.isValid(mealId)) {
        return res.status(400).json({ error: "ID piatto non valido" });
    }

    try {
        const existingRestaurant = await client
            .db('FastFood')
            .collection('restaurants')
            .findOne({ _id: new ObjectId(restaurantId), deleteDate: null });
        
        if (!existingRestaurant) {
            return res.status(404).json({ error: "Ristorante non trovato" });
        }

        const existingMeal = await client
            .db('FastFood')
            .collection('meals')
            .findOne({ _id: new ObjectId(mealId), deleteDate: null });

        if (!existingMeal) {
            return res.status(404).json({ error: "Piatto non trovato" });
        }

        const filter = { restaurantId: new ObjectId(restaurantId), mealId: new ObjectId(mealId) };
        const result = await client
            .db('FastFood')
            .collection('menus')
            .deleteOne(filter);

        if (result.deletedCount === 1) {
            res.status(200).json({ message: "Elemento del menu eliminato con successo" });
        } else {
            res.status(404).json({ error: "Elemento del menu non trovato" });
        }
    } catch (error) {
        res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// ---- Meals Routes

// Create Specialty Meal Route
// - This route creates a specialty meal for a restaurant.
// - It checks if all required fields are provided and valid, including the restaurant ID.
// - If the validation passes, it inserts the specialty meal into the meals collection and creates a corresponding menu item.
// - If the insertion is successful, it returns a success message with the inserted ID.
// - If any validation fails or if the restaurant ID is invalid, it returns an error message.
app.post('/meals', async (req, res) => {
    const { name, category, area, instructions, prepTime, imgUrl, ingredients, restaurantId, price } = req.body;

    if (!name || !category || !prepTime || !imgUrl || !ingredients || !restaurantId || !price) {
        return res.status(400).json({ error: "Compilare tutti i campi obbligatori" });
    }

    if (!ObjectId.isValid(restaurantId)) {
        return res.status(400).json({ error: "ID ristorante non valido" });
    }

    if (name.length < 2 || !/^[a-zA-Z0-9\s]+$/.test(name)) {
        return res.status(400).json({ error: "Nome piatto non valido" });
    }

    if (['first', 'second', 'dessert'].includes(category) === false) {
        return res.status(400).json({ error: "Categoria non valida" });
    }

    if (area && !/^[a-zA-Z0-9\s]+$/.test(area)) {
        return res.status(400).json({ error: "Area non valida" });
    }

    if (prepTime <= 0) {
        return res.status(400).json({ error: "Il tempo di preparazione deve essere maggiore di zero" });
    }

    if (imgUrl.length < 5 || !/^https?:\/\/.+\.(jpg|jpeg|png|gif)$/.test(imgUrl)) {
        return res.status(400).json({ error: "URL immagine non valido" });
    }

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
        return res.status(400).json({ error: "Ingredienti non validi" });
    }

    if (price <= 0) {
        return res.status(400).json({ error: "Il prezzo deve essere maggiore di zero" });
    }

    try { 
        const existingRestaurant = await client
            .db('FastFood')
            .collection('restaurants')
            .findOne({ _id: new ObjectId(restaurantId), deleteDate: null });

        if (!existingRestaurant) {
            return res.status(404).json({ error: "Ristorante non trovato" });
        }
        
        const specialty = {
            name: name,
            category: category,
            area: area,
            instructions: instructions || "",
            prepTime: prepTime,
            imgUrl: imgUrl,
            isSpecialty: true,
            ingredients: ingredients || [],
            deleteDate: null
        };

        const mealResult = await client.db('FastFood')
            .collection('meals')
            .insertOne(specialty);

        const menuItem = {
            restaurantId: new ObjectId(restaurantId),
            mealId: mealResult.insertedId,
            price: price,
            discount: null
        };

        const menuResult = await client.db('FastFood')
            .collection('menus')
            .insertOne(menuItem);

        const result = {
            meal: mealResult,
            menu: menuResult,
        };

        if (result.meal.insertedId && result.menu.insertedId) {
            res.status(201).json({ message: "Specialità del ristorante creata con successo", insertedId: result.meal.insertedId });
        } else {
            res.status(400).json({ error: "Errore nella creazione della specialità" });
        }
    } catch (error) {
        res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Get Meals Route
// - This route retrieves all meals that are not specialties from the database.
// - It allows filtering by category or name using query parameters.
// - It queries the meals collection for meals where isSpecialty is false and returns them in an array with a success message.
// - If an error occurs during the query, it returns an error message.
app.get('/meals', async (req, res) => {
    try {
        const { search } = req.query;

        const filter = { isSpecialty: false };

        if (['first', 'second', 'dessert'].includes(search)) {
            filter.category = search;
        } else if (search) {
            filter.name = { $regex: new RegExp(`^${search}`, 'i') };
        }

        const meals = await client
            .db('FastFood')
            .collection('meals')
            .find(filter)
            .toArray();

        res.status(200).json({ message: "Pasti trovati", meals: meals });
    } catch (error) {
        res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Get Meal by ID Route
// - This route retrieves a meal's details by its ID.
// - It checks if the ID is valid and queries the database for the meal.
// - If found, it returns the meal's details with a success message.
// - If not found, it returns an error message.
app.get('/meals/:id', async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID non valido" });
    }

    try {
        const filter = { _id: new ObjectId(id), deleteDate: null };
        const meal = await client
            .db('FastFood')
            .collection('meals')
            .findOne(filter);

        if (meal) {
            res.status(200).json({ message: "Piatto trovato", meal: meal });
        } else {
            res.status(404).json({ error: "Piatto non trovato" });
        }
    } catch (error) {
        res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Update Meal Route
// - This route updates a meal's details by its ID.
// - It checks if the ID is valid and if at least one field provided is valid for update.
// - It also checks if the meal is a specialty of the given restaurant, otherwise it returns an error.
// - If the restaurant and meal exist, it updates the meal's details returning a success message.
// - If the ID is invalid or no fields provided is valid for update, it returns an
app.put('/meals/:id', async (req, res) => {
    const id = req.params.id;
    const { name, category, area, instructions, prepTime, imgUrl, ingredients, price, discount, restaurantId } = req.body;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID non valido" });
    }

    if (!ObjectId.isValid(restaurantId)) {
        return res.status(400).json({ error: "ID ristorante non valido" });
    }

    try {
        const existingRestaurant = await client
            .db('FastFood')
            .collection('restaurants')
            .findOne({ _id: new ObjectId(restaurantId), deleteDate: null });

        if (!existingRestaurant) {
            return res.status(404).json({ error: "Ristorante non trovato" });
        }
        
        const existingMeal = await client
            .db('FastFood')
            .collection('meals')
            .findOne({ _id: new ObjectId(id), deleteDate: null, isSpecialty: true });

        if (!existingMeal) {
            return res.status(404).json({ error: "Piatto non trovato o non è una specialità" });
        }

        const filterMenu = { mealId: new ObjectId(id), restaurantId: new ObjectId(restaurantId) }; 
        const checkMenu = await client
            .db('FastFood')
            .collection('menus')
            .findOne(filterMenu);

        if (!checkMenu) {
            return res.status(404).json({ error: "Piatto non trovato nel menu del ristorante" });
        }

        const updateFieldsMeal = {};

        if (name) {
            if (name.length < 2 || !/^[a-zA-Z0-9\s]+$/.test(name)) {
                return res.status(400).json({ error: "Nome piatto non valido" });
            }
            updateFieldsMeal.name = name;
        }

        if (area) {
            if (area.length < 2 || !/^[a-zA-Z0-9\s]+$/.test(area)) {
                return res.status(400).json({ error: "Area non valida" });
            }
            updateFieldsMeal.area = area;
        }

        if (category) {
            if (['first', 'second', 'dessert'].includes(category) === false) {
                return res.status(400).json({ error: "Categoria non valida" });
            }
            updateFieldsMeal.category = category;
        }

        if (instructions) {
            updateFieldsMeal.instructions = instructions;
        }

        if (prepTime) {
            if (prepTime <= 0) {
                return res.status(400).json({ error: "Il tempo di preparazione deve essere maggiore di zero" });
            }
            updateFieldsMeal.prepTime = prepTime;
        }

        if (imgUrl) {
            if (imgUrl.length < 5 || !/^https?:\/\/.+\.(jpg|jpeg|png|gif)$/.test(imgUrl)) {
                return res.status(400).json({ error: "URL immagine non valido" });
            }
            updateFieldsMeal.imgUrl = imgUrl;
        }

        if (ingredients && ingredients.length > 0) {
            if (!Array.isArray(ingredients) || ingredients.length === 0) {
                return res.status(400).json({ error: "Ingredienti non validi" });
            }
            updateFieldsMeal.ingredients = ingredients;
        }

        if (price || discount !== undefined) {
            if (price && price <= 0) {
                return res.status(400).json({ error: "Il prezzo deve essere maggiore di zero" });
            }

            if (discount !== undefined && (discount < 0 || discount >= 100)) {
                return res.status(400).json({ error: "Lo sconto deve essere tra 0 e 99" });
            }

            const filterMenu = { mealId: new ObjectId(id), restaurantId: new ObjectId(restaurantId) };
            const updateFieldsMenu = {};
            
            if (price) updateFieldsMenu.price = price;
            if (discount !== undefined) updateFieldsMenu.discount = discount;
            
            const menuResult = await client
                .db('FastFood')
                .collection('menus')
                .updateOne(filterMenu, { $set: updateFieldsMenu });

            if (menuResult.matchedCount <= 0) {
                return res.status(404).json({ error: "Piatto non trovato nel menu del ristorante" });
            }
        }

        const filter = { _id: new ObjectId(id), deleteDate: null, isSpecialty: true };
        const mealResult = await client
            .db('FastFood')
            .collection('meals')
            .updateOne(filter, { $set: updateFieldsMeal });

        if (mealResult.matchedCount <= 0) {
            return res.status(404).json({ error: "Piatto non trovato" });
        }

        res.status(200).json({ message: "Piatto aggiornato con successo" });
    } catch (error) {
        res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Delete Meal Route
// - This route logically deletes a specialty meal by its ID.
// - It checks if the ID is valid and if the meal is a specialty.
// - It also checks if the meal is part of the given restaurant's menu, otherwise it returns an error.
// - If the deletion is successful, it returns a success message with the number of deleted menu items.
// - If the ID is invalid or the meal is not found, it returns an error message
app.delete('/meals/:id', async (req, res) => {
    const id = req.params.id;
    const restaurantId = req.query.restaurantId;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID meal non valido" });
    }

    if (!ObjectId.isValid(restaurantId)) {
        return res.status(400).json({ error: "ID ristoratore non valido" });
    }

    try {
        const meal = await client
            .db('FastFood')
            .collection('meals')
            .findOne({ _id: new ObjectId(id), deleteDate: null, isSpecialty: true });

        if (!meal) {
            return res.status(404).json({ error: "Piatto non trovato" });
        }

        const filter = { mealId: new ObjectId(id), restaurantId: new ObjectId(restaurantId) };
        const menuItem = await client
            .db('FastFood')
            .collection('menus')
            .findOne(filter);

        if (!menuItem) {
            return res.status(403).json({ error: "Solo il proprietario può eliminare la propria specialità" });
        }

        const deleteMenuResult = await client
            .db('FastFood')
            .collection('menus')
            .deleteOne(filter);

        if (deleteMenuResult.deletedCount <= 0) {
            return res.status(404).json({ error: "Piatto non trovato nel menu del ristorante" });
        }

        const deleteMealResult = await client
            .db('FastFood')
            .collection('meals')
            .updateOne({ _id: new ObjectId(id), deleteDate: null, isSpecialty: true }, { $set: { deleteDate: new Date() } });

        if (deleteMealResult.modifiedCount > 0) {
            res.status(200).json({ message: "Piatto eliminato con successo" });
        } else {
            res.status(404).json({ error: "Piatto non trovato" });
        }
    } catch (error) {
        res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// ---- Orders routes

// Create Order Route
// - This route creates a new order for a customer from a restaurant.
// - It checks if the customer ID and restaurant ID are valid, and if the meals array is provided and not empty.
// - It checks if the restaurant, customer and meals exist in the database.
// - It calculates the total price of the order based on the meals and their quantities.
// - If the order is created successfully, it returns a success message with the order ID.
// - If any validation fails or if the order creation fails, it returns an error message.
app.post('/orders', async (req, res) => {
    const { customerId, restaurantId, meals, estimatedTime } = req.body;

    if (!ObjectId.isValid(customerId)) {
        return res.status(400).json({ error: "ID cliente non valido" });
    }

    if (!ObjectId.isValid(restaurantId)) {
        return res.status(400).json({ error: "ID ristorante non valido" });
    }

    if (!Array.isArray(meals) || meals.length === 0) {
        return res.status(400).json({ error: "Nessun elemento nell'ordine" });
    }

    if (estimatedTime && estimatedTime <= 0) {
        return res.status(400).json({ error: "Il tempo stimato deve essere maggiore di zero" });
    }

    for (const meal of meals) {
        if (!ObjectId.isValid(meal.mealId)) {
            return res.status(400).json({ error: "ID piatto non valido" });
        }
        if (meal.quantity <= 0) {
            return res.status(400).json({ error: "La quantità deve essere maggiore di zero" });
        }
        if (meal.price <= 0) {
            return res.status(400).json({ error: "Il prezzo deve essere maggiore di zero" });
        }
        if (meal.prepTime <= 0) {
            return res.status(400).json({ error: "Il tempo di preparazione deve essere maggiore di zero" });
        }
    }

    try {
        const restaurant = await client
            .db('FastFood')
            .collection('restaurants')
            .findOne({ _id: new ObjectId(restaurantId), deleteDate: null });

        if (!restaurant) {
            return res.status(404).json({ error: "Ristorante non trovato" });
        }

        const customer = await client
            .db('FastFood')
            .collection('customers')
            .findOne({ _id: new ObjectId(customerId), deleteDate: null });

        if (!customer) {
            return res.status(404).json({ error: "Cliente non trovato" });
        }

        const mealIds = meals.map(meal => new ObjectId(meal.mealId));
        const existingMeals = await client
            .db('FastFood')
            .collection('meals')
            .find({
                _id: { $in: mealIds },
                deleteDate: null,
            })
            .toArray();

        if (existingMeals.length !== meals.length) {
            return res.status(404).json({ error: "Uno o più piatti non trovati" });
        }

        const menuItems = await client
            .db('FastFood')
            .collection('menus')
            .find({
                restaurantId: new ObjectId(restaurantId),
                mealId: { $in: mealIds }
            })
            .toArray();
        
        if (menuItems.length !== meals.length) {
            return res.status(404).json({ error: "Uno o più piatti non sono disponibili nel menu del ristorante" });
        }

        const order = {
            customerId: new ObjectId(customerId),
            restaurantId: new ObjectId(restaurantId),
            meals: meals.map(meal => ({
                mealId: new ObjectId(meal.mealId),
                quantity: meal.quantity,
                price: meal.price
            })),
            totalPrice: meals.reduce((total, meal) => total + (meal.price * meal.quantity), 0),
            prepTime: meals.reduce((total, meal) => total + meal.prepTime * meal.quantity, 0),
            estimatedTime: estimatedTime,
            status: 'ordered',
            orderTime: new Date(),
            deliveryTime: null
        };

        const result = await client
            .db('FastFood')
            .collection('orders')
            .insertOne(order);

        if (result.insertedId) {
            res.status(201).json({ message: "Ordine creato con successo", insertedId: result.insertedId });
        } else {
            res.status(400).json({ error: "Errore nella creazione dell'ordine" });
        }
    } catch (error) {
        res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Get Orders Route
// - This route retrieves all orders for a customer or a restaurant based on the role provided in the query parameters.
// - It checks if the role is valid (customer or restaurateur) and retrieves the orders accordingly.
// - It uses aggregation to join the orders with customer, restaurant details, and meal data.
// - If the role is customer, it retrieves orders for the customer ID provided in the query parameters.
// - If the role is restaurateur, it retrieves orders for the restaurant ID provided in the query parameters.
// - If the orders are found, it returns them with a success message.
app.get('/orders', async (req, res) => {
    try {
        const { role, id } = req.query;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "ID non valido" });
        }
        
        let filter = {};
        let lookupUser;
        if (role === 'restaurateur') {
            filter.restaurantId = new ObjectId(id);
            lookupUser = {
                $lookup: {
                    from: 'customers',
                    localField: 'customerId',
                    foreignField: '_id',
                    as: 'customer'
                }
            };
        } else if (role === 'customer') {
            filter.customerId = new ObjectId(id);
            lookupUser = {
                $lookup: {
                    from: 'restaurants',
                    localField: 'restaurantId',
                    foreignField: '_id',
                    as: 'restaurant'
                }
            }
        } else {
            return res.status(400).json({ error: "Ruolo non valido" });
        }

        const orders = await client
            .db('FastFood')
            .collection('orders').aggregate([
                { $match: filter },
                
                lookupUser,
                
                {
                    $lookup: {
                        from: 'meals',
                        localField: 'meals.mealId',
                        foreignField: '_id',
                        as: 'mealsDetails'
                    }
                },
            ]).toArray();

        res.json({ message: 'Ordini trovati', orders });
    } catch (error) {
        res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});

// Update Order Status Route
// - This route updates the status of an order by its ID.
// - It checks if the ID is valid and if the status is one of the allowed values (in_progress, delivered).
// - If the status is 'delivered', it also sets the delivery time to the current date.
// - If the update is successful, it returns a success message.
// - If the ID is invalid or the status is not allowed, it returns an error message.
app.put('/orders/:id', async (req, res) => {
    const id = req.params.id;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID ordine non valido" });
    }

    if (!['in_progress', 'delivered'].includes(status)) {
        return res.status(400).json({ error: "Stato ordine non valido" });
    }

    try {
        const filter = { _id: new ObjectId(id) };
        const order = await client
            .db('FastFood')
            .collection('orders')
            .findOne({ _id: new ObjectId(id), deleteDate: null });

        if (!order) {
            return res.status(404).json({ error: "Ordine non trovato" });
        }

        if (order.status === 'delivered') {
            return res.status(400).json({ error: "L'ordine è già stato consegnato" });
        }

        if (order.status === 'in_progress' && status !== 'delivered') {
            return res.status(400).json({ error: "L'ordine è già in preparazione" });
        }

        if (order.status === 'ordered' && status !== 'in_progress') {
            return res.status(400).json({ error: "L'ordine deve essere in preparazione prima di essere consegnato" });
        }

        const updateFields = { status: status };

        if (status === 'delivered') {
            updateFields.deliveryTime = new Date();
        }

        const result = await client
            .db('FastFood')
            .collection('orders')
            .updateOne(filter, { $set: updateFields });

        if (result.modifiedCount > 0) {
            res.status(200).json({ message: "Ordine aggiornato con successo" });
        } else {
            res.status(404).json({ error: "Ordine non trovato" });
        }
    } catch (error) {
        res.status(500).json({ error: `Errore non gestito: ${error.message}` });
    }
});