let cart = {
    restaurantId: null,
    restaurantName: '',
    items: [],
    total: 0,
    prepTime: 0,
    restWaitingTime: -1
};

document.addEventListener('DOMContentLoaded', function() {
    const savedCart = sessionStorage.getItem('cart');

    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartDisplay();
    }
});

// Function that handle the display of the cart
// - It updates the off-canvas cart sections based on the cart in session storage.
function updateCartDisplay() {
    const cartBadge = document.getElementById('cartBadge');
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const cartFooter = document.getElementById('cartFooter');
    const emptyCartMessage = document.getElementById('emptyCartMessage');
    const cartRestaurantInfo = document.getElementById('cartRestaurantInfo');
    const cartRestaurantName = document.getElementById('cartRestaurantName');
    const cartEstimatedTime = document.getElementById('cartEstimatedTime');

    cartItems.innerHTML = '';

    if (cart.items.length === 0) {
        cartBadge.classList.add('d-none');

        emptyCartMessage.style.display = 'block';
        cartFooter.classList.add('d-none');
        cartFooter.classList.remove('d-block');
        cartRestaurantInfo.classList.add('d-none');
    } else {
        cartBadge.textContent = cart.items.length;
        cartBadge.classList.remove('d-none');
        emptyCartMessage.style.display = 'none';
        cartFooter.classList.remove('d-none');
        cartFooter.classList.add('d-block');
        cartRestaurantInfo.classList.remove('d-none');
        cartRestaurantName.textContent = cart.restaurantName;

        cartEstimatedTime.textContent = `${cart.prepTime} + ${cart.restWaitingTime} min`;

        cart.items.forEach(item => {
            cartItems.appendChild(createCartItem(item));
        });

        cartTotal.textContent = `€${cart.total.toFixed(2)}`;
    }
}

// Function to add an item to the cart
// - It checks if the restaurantId matches the current cart's restaurantId.
// - If it does, it adds the meal to the cart or increases its quantity.
function addToCart(restaurantId, restaurantName, meal, finalPrice) {
    if (cart.restaurantId && cart.restaurantId !== restaurantId) {
        showAlert(`Il tuo carrello contiene già piatti da "${cart.restaurantName}".`, 'error');
        return false;
    }

    if (!cart.restaurantId) {
        cart.restaurantId = restaurantId;
        cart.restaurantName = restaurantName;
    }

    const existingItem = cart.items.find(item => String(item.mealId) === String(meal._id));

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.items.push({
            mealId: meal._id,
            name: meal.name,
            category: meal.category,
            price: finalPrice,
            prepTime: meal.prepTime,
            quantity: 1,
        });
    }

    cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    cart.prepTime = cart.items.reduce((sum, item) => sum + item.prepTime * item.quantity, 0);
    sessionStorage.setItem('cart', JSON.stringify(cart));
    updateCartDisplay();
    
    showAlert(`"${meal.name}" aggiunto al carrello!`, 'success');
    return true;
}

// Function that creates a cart item
// - It clones a template element and fills it with the item data.
// - It adds event listeners for increasing, decreasing quantity and removing the item.
function createCartItem(item) {
    const model = document.getElementById('cartItemModel');
    const clone = model.cloneNode(true);
    clone.querySelector('.cart-item-name').textContent = item.name;
    clone.querySelector('.cart-item-category').textContent = item.category;
    clone.querySelector('.cart-item-quantity').textContent = item.quantity;
    clone.querySelector('.cart-item-price').textContent = `€${(item.price * item.quantity).toFixed(2)}`;

    clone.querySelector('.increase-quantity').addEventListener('click', () => {
        updateQuantity(item.mealId, 1);
    });

    clone.querySelector('.decrease-quantity').addEventListener('click', () => {
        updateQuantity(item.mealId, -1);
    });

    clone.querySelector('.remove-item').addEventListener('click', () => {
        removeFromCart(item.mealId);
    });

    clone.classList.remove('d-none');
    clone.id = `${item.mealId}`;

    return clone;
}

// Function to remove an item from the cart
// - It finds the item by mealId and removes it from the cart.
// - If the cart becomes empty, it resets restaurant info.
function removeFromCart(mealId) {
    cart.items = cart.items.filter(item => item.mealId !== mealId);
    
    if (cart.items.length === 0) {
        cart.restaurantId = null;
        cart.restaurantName = '';
        cart.restWaitingTime = -1;
        sessionStorage.removeItem('cart');
    }
    
    cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    cart.prepTime = cart.items.reduce((sum, item) => sum + item.prepTime * item.quantity, 0);
    sessionStorage.setItem('cart', JSON.stringify(cart));
    updateCartDisplay();
}

// Function to update the quantity of an item in the cart
// - It finds the item by mealId and updates its quantity.
// - If the quantity becomes zero, it removes the item from the cart.
function updateQuantity(mealId, change) {
    const item = cart.items.find(item => item.mealId === mealId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(mealId);
        } else {
            cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            cart.prepTime = cart.items.reduce((sum, item) => sum + item.prepTime * item.quantity, 0);
            sessionStorage.setItem('cart', JSON.stringify(cart));
            updateCartDisplay();
        }
    }
}

// Function that clears the cart
// - It resets the cart object and updates the display.
function clearCart() {
    cart = {
        restaurantId: null,
        restaurantName: '',
        items: [],
        total: 0,
        prepTime: 0,
        restWaitingTime: -1
    };
    
    sessionStorage.removeItem('cart');
    updateCartDisplay();
    showAlert('Carrello svuotato', 'success');
}

// Function that processes the order
// - It checks if the cart is empty, and if not, it prepares the order data.
// - It sends a POST request to the server to create the order.
function processOrder() {
    if (cart.items.length === 0) {
        showAlert('Il carrello è vuoto', 'error');
        return;
    }

    const order = {
        customerId: userData._id,
        restaurantId: cart.restaurantId,
        meals: cart.items.map(item => ({
            mealId: item.mealId,
            quantity: item.quantity,
            price: item.price,
            prepTime: item.prepTime
        })),
        estimatedTime: cart.prepTime + cart.restWaitingTime,
    };

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(order)
    };

    fetch('http://localhost:3005/orders', options)
        .then(res => res.json())
        .then(data => {
            console.log('Risposta del server:', data);
            if (data.message && data.insertedId) {
                clearCart();
                showAlert('Ordine inserito con successo', 'success');
            } else if (data.error) {
                showAlert('Errore durante l\'inserimento dell\'ordine: ' + (data.error), 'error');
            }
        })
        .catch(error => {
            console.error('Errore durante l\'inserimento dell\'ordine:', error);
            showAlert('Errore durante l\'inserimento dell\'ordine: ' + (data.error), 'error');
        });
}