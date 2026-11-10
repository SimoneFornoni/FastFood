# FastFood

FastFood is a food-ordering web application for managing restaurants, meals, and customer orders. The project combines a Node.js/Express backend with a MongoDB database and a lightweight frontend built with static HTML, CSS, and JavaScript pages.

The application supports:
- customer authentication and profile management
- restaurateur authentication and restaurant management
- restaurant menu and specialty meal management
- order creation and order-state updates
- restaurant statistics and dashboard views

## Project overview

The backend is implemented in [main.js](main.js), which exposes a REST API for the main business flows. The API is documented in [swagger.json](swagger.json) and can be explored through Swagger UI at `/swagger` when the server is running.

The frontend is organized in the [lib/](lib/) folder and the root HTML entry point [index.html](index.html). It includes pages for restaurants, meals, profiles, orders, and dashboards.

## Repository structure

- [main.js](main.js): Express server, MongoDB connection, and all API routes
- [swagger.js](swagger.js): Swagger generation configuration
- [swagger.json](swagger.json): generated OpenAPI document
- [package.json](package.json): project metadata and dependencies
- [index.html](index.html): landing page
- [js/](js/): client-side JavaScript logic
- [lib/](lib/): front-end HTML pages
- [meals/](meals/): sample meal data
- [Documentation.pdf](Documentation.pdf): full project documentation, including the database schema and API details

## Database structure

The application uses MongoDB and stores its data in the `FastFood` database.

Main collections:

- `customers`
  - stores customer profile information
  - typical fields: `_id`, `name`, `lastName`, `email`, `password`, `phone`, `paymentMethod`, `preference`, `deleteDate`

- `restaurateurs`
  - stores the restaurant owner accounts
  - typical fields: `_id`, `name`, `lastName`, `email`, `password`, `phone`, `pIva`

- `restaurants`
  - stores each restaurant record
  - typical fields: `_id`, `owner`, `name`, `address`, `phone`, `description`, `openingTime`, `closingTime`, `deleteDate`

- `meals`
  - stores meals and specialty dishes
  - typical fields: `_id`, `name`, `category`, `area`, `instructions`, `prepTime`, `imgUrl`, `ingredients`, `isSpecialty`, `deleteDate`

- `menus`
  - links restaurants to meals and stores restaurant-specific pricing information
  - typical fields: `_id`, `restaurantId`, `mealId`, `price`, `discount`

- `orders`
  - stores customer orders and current order lifecycle
  - typical fields: `_id`, `customerId`, `restaurantId`, `meals[]`, `totalPrice`, `prepTime`, `estimatedTime`, `status`, `orderTime`, `deliveryTime`

The schema uses soft deletion via `deleteDate` fields rather than permanent record deletion, and MongoDB ObjectIds are used to relate entities across collections.

## API structure

The backend exposes endpoints for:
- login and authentication
- customer CRUD operations
- restaurateur CRUD operations
- restaurant creation, retrieval, update, and deletion
- restaurant menu management
- meal creation and retrieval
- order creation, retrieval, and status updates

The project also includes Swagger support through [swagger.js](swagger.js) and [swagger.json](swagger.json).

## API and documentation

For the complete and detailed project documentation, including the database schema and the full list of API routes, see:

- [Documentation.pdf](Documentation.pdf)

The project also ships with an interactive API explorer available when the server is running at:

- `http://localhost:3005/swagger`

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start MongoDB and set the connection URI:
   ```bash
   export MONGO_URI="mongodb://127.0.0.1:27017"
   ```

3. Start the API server:
   ```bash
   node main.js
   ```

4. Open the web app from the root HTML file or use the API locally on port `3005`.

## Notes

This repository is mainly a backend-driven web application, with the frontend pages acting as clients for the API. For the most complete specification of the system design, database layout, and endpoints, refer to [Documentation.pdf](Documentation.pdf).
