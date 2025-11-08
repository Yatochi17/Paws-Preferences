/*
PAWS & PREFERENCES - CAT TINDER APP
Main functionality for swipe-based cat rating application
Features: image preloading, drag/swipe gestures, card stacking, progress tracking
UPDATED: Caches images for correct summary display + loads new cats on restart
*/

// ============ CONFIGURATION CONSTANTS ============
const CAT_COUNT = 15;                    // Total number of cats to display
const SWIPE_THRESHOLD = 100;            // Minimum pixels to register swipe
const SWIPE_ANIMATION_DURATION = 300;   // Animation time in milliseconds

// ============ APPLICATION STATE VARIABLES ============
let cats = [];           // Array storing all cat image URLs
let catImages = [];      // Array storing cached image data URLs
let currentIndex = 0;    // Current position in the cat array
let likedCats = [];      // Array storing indices of liked cats
let isDragging = false;  // Track if user is currently dragging a card
let startX = 0;          // Starting X position of drag gesture
let currentX = 0;        // Current X position during drag
let currentCard = null;  // Reference to the current active card DOM element

// ============ IMAGE MANAGEMENT FUNCTIONS ============

/**
 * Generates unique cat image URLs from Cataas API
 * Each URL includes timestamp to ensure fresh images
 * @returns {Array} Array of cat image URLs
 */
function generateCatUrls() {
    const urls = [];
    const timestamp = Date.now(); // Unique timestamp for this session
    for (let i = 0; i < CAT_COUNT; i++) {
        // Using Cataas.com cat API with timestamp to get new cats each time
        urls.push(`https://cataas.com/cat?${timestamp}-${i}&width=500&height=500`);
    }
    return urls;
}

/**
 * Preloads all cat images and caches them as data URLs
 * This ensures the same image appears in the summary
 * @param {Array} urls - Array of image URLs to preload
 * @returns {Promise} Resolves when all images are loaded
 */
async function preloadImages(urls) {
    const promises = urls.map((url, index) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Enable CORS
            img.onload = () => {
                // Convert image to data URL for caching
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                catImages[index] = canvas.toDataURL('image/jpeg');
                resolve(url);
            };
            img.onerror = () => resolve(url);    // Still resolve on error
            img.src = url;
        });
    });
    return Promise.all(promises);
}

// ============ APPLICATION INITIALIZATION ============

/**
 * Main initialization function
 * Sets up the app, preloads images, and starts the interface
 */
async function init() {
    // Step 1: Generate and preload cat images
    cats = generateCatUrls();
    await preloadImages(cats);
    
    // Step 2: Switch from loading screen to main app
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    
    // Step 3: Render initial card and update UI
    renderCard();
    updateCounter();
}

// ============ CARD RENDERING AND MANAGEMENT ============

/**
 * Renders the current card and prepares the card stack
 * Creates a visual stack of 3 cards for better user experience
 */
function renderCard() {
    const cardStack = document.getElementById('cardStack');
    cardStack.innerHTML = ''; // Clear existing cards

    // Check if we've reached the end of the cat array
    if (currentIndex >= cats.length) {
        showSummary();
        return;
    }

    // Render current card and next 2 cards for stack visual effect
    for (let i = currentIndex; i < Math.min(currentIndex + 3, cats.length); i++) {
        const card = createCardElement(i);
        
        // Only set up event listeners for the top (current) card
        if (i === currentIndex) {
            currentCard = card;
            setupCardListeners(card);
        }

        cardStack.appendChild(card);
    }
}

/**
 * Creates a card DOM element with proper styling and content
 * @param {number} index - Position in the cats array
 * @returns {HTMLElement} Card DOM element
 */
function createCardElement(index) {
    const card = document.createElement('div');
    card.className = 'cat-card';
    card.style.zIndex = cats.length - index; // Lower z-index for cards further back
    
    // Apply stack effect to cards that aren't the current one
    if (index > currentIndex) {
        applyStackStyle(card, index - currentIndex);
    }

    // Card content: image and swipe indicators
    card.innerHTML = `
        <img src="${catImages[index] || cats[index]}" alt="Cat ${index + 1}" loading="lazy">
        <div class="swipe-indicator left">👎</div>
        <div class="swipe-indicator right">❤️</div>
    `;

    return card;
}

/**
 * Applies visual styling to create stack effect
 * @param {HTMLElement} card - Card element to style
 * @param {number} position - Position in stack (1, 2, etc.)
 */
function applyStackStyle(card, position) {
    const scale = 1 - position * 0.05;      // Slightly smaller
    const translateY = position * 10;       // Slightly lower
    const opacity = 1 - position * 0.2;     // Slightly transparent
    
    card.style.transform = `scale(${scale}) translateY(${translateY}px)`;
    card.style.opacity = opacity;
}

// ============ EVENT HANDLING FOR DRAG/SWIPE GESTURES ============

/**
 * Sets up mouse and touch event listeners for card interaction
 * @param {HTMLElement} card - Card element to add listeners to
 */
function setupCardListeners(card) {
    // Mouse events for desktop
    card.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);

    // Touch events for mobile
    card.addEventListener('touchstart', handleStart);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
}

/**
 * Handles the start of drag/swipe gesture
 * @param {Event} e - Mouse or touch event
 */
function handleStart(e) {
    isDragging = true;
    // Get starting position (handle both mouse and touch events)
    startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    currentCard.style.transition = 'none'; // Disable transitions during drag
}

/**
 * Handles movement during drag/swipe gesture
 * Updates card position and shows swipe indicators
 * @param {Event} e - Mouse or touch event
 */
function handleMove(e) {
    if (!isDragging) return;

    // Get current position
    currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const deltaX = currentX - startX;
    const rotate = deltaX * 0.1; // Calculate rotation based on drag distance

    // Apply movement and rotation to card
    currentCard.style.transform = `translateX(${deltaX}px) rotate(${rotate}deg)`;

    // Show/hide swipe direction indicators
    updateSwipeIndicators(deltaX);
}

/**
 * Shows or hides swipe direction indicators based on drag distance
 * @param {number} deltaX - Horizontal drag distance
 */
function updateSwipeIndicators(deltaX) {
    if (deltaX < -50) {
        // Swiping left (dislike)
        currentCard.classList.add('swiping-left');
        currentCard.classList.remove('swiping-right');
    } else if (deltaX > 50) {
        // Swiping right (like)
        currentCard.classList.add('swiping-right');
        currentCard.classList.remove('swiping-left');
    } else {
        // Not enough movement - hide indicators
        currentCard.classList.remove('swiping-left', 'swiping-right');
    }
}

/**
 * Handles the end of drag/swipe gesture
 * Determines if swipe was sufficient and processes the decision
 * @param {Event} e - Mouse or touch event
 */
function handleEnd(e) {
    if (!isDragging) return;
    isDragging = false;

    const deltaX = currentX - startX;
    
    // Check if drag distance exceeds threshold for swipe
    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
        // Process swipe - true for right (like), false for left (dislike)
        swipeCard(deltaX > 0);
    } else {
        // Not enough movement - return card to center
        resetCardPosition();
    }
}

/**
 * Returns card to center position after insufficient swipe
 */
function resetCardPosition() {
    currentCard.style.transition = 'transform 0.3s ease';
    currentCard.style.transform = '';
    currentCard.classList.remove('swiping-left', 'swiping-right');
}

// ============ CARD SWIPE ANIMATION AND PROCESSING ============

/**
 * Animates card swipe and processes the user's decision
 * @param {boolean} liked - True for like, false for dislike
 */
function swipeCard(liked) {
    const direction = liked ? 1 : -1; // 1 for right, -1 for left
    
    // Animate card off screen
    currentCard.style.transition = 'transform 0.5s ease';
    currentCard.style.transform = `translateX(${direction * 1000}px) rotate(${direction * 30}deg)`;

    // Store liked cat index instead of URL
    if (liked) {
        likedCats.push(currentIndex);
    }

    // Move to next card after animation completes
    setTimeout(() => {
        currentIndex++;
        updateCounter();
        renderCard();
    }, SWIPE_ANIMATION_DURATION);
}

// ============ BUTTON EVENT HANDLERS ============

// Dislike button click handler
document.getElementById('btnDislike').addEventListener('click', () => {
    if (currentIndex < cats.length) {
        swipeCard(false); // Simulate left swipe
    }
});

// Like button click handler
document.getElementById('btnLike').addEventListener('click', () => {
    if (currentIndex < cats.length) {
        swipeCard(true); // Simulate right swipe
    }
});

// Restart button - resets app to initial state
document.getElementById('btnRestart').addEventListener('click', resetApp);

/**
 * Resets the application to its initial state
 * Clears all data and restarts the swiping process with NEW cat images
 */
async function resetApp() {
    const appContainer = document.getElementById('app');
    appContainer.classList.remove('summary-mode');
    
    // Show loading screen while fetching new cats
    document.getElementById('app').style.display = 'none';
    document.getElementById('loading').style.display = 'block';
    
    // Reset state variables
    currentIndex = 0;
    likedCats = [];
    cats = [];
    catImages = [];
    
    // Generate and preload NEW cat images
    cats = generateCatUrls();
    await preloadImages(cats);
    
    // Switch back to main app
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    
    // Reset UI visibility
    document.getElementById('summary').style.display = 'none';
    document.getElementById('buttons').style.display = 'flex';
    document.getElementById('counter').style.display = 'block';
    document.querySelector('.progress-container').style.display = 'block';
    
    // Re-render interface with new cats
    renderCard();
    updateCounter();
    
    // Scroll to top for better user experience
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ PROGRESS AND COUNTER UPDATES ============

/**
 * Updates the counter showing current position (e.g., "1/15")
 * Also updates the progress bar
 */
function updateCounter() {
    document.getElementById('counter').textContent = 
        `${currentIndex + 1} / ${cats.length}`;
    updateProgressBar();
}

/**
 * Updates the visual progress bar based on current position
 */
function updateProgressBar() {
    const progress = ((currentIndex + 1) / cats.length) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;
}

// ============ SUMMARY SCREEN FUNCTIONS ============

/**
 * Displays the summary screen with user's results
 * Shows statistics and grid of liked cats
 */
function showSummary() {
    const appContainer = document.getElementById('app');
    appContainer.classList.add('summary-mode');
    
    // Hide interactive elements
    document.getElementById('buttons').style.display = 'none';
    document.getElementById('counter').style.display = 'none';
    document.querySelector('.progress-container').style.display = 'none';
    
    // Display statistics and liked cats
    displayStatistics();
    displayLikedCats();
    
    // Show summary section
    document.getElementById('summary').style.display = 'block';
    
    // Scroll to top for better user experience
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Calculates and displays user statistics
 */
function displayStatistics() {
    const stats = document.getElementById('stats');
    const percentage = Math.round((likedCats.length / cats.length) * 100);
    
    stats.innerHTML = `
        <p class="subtitle">You've reviewed all ${cats.length} cats!</p>
        <p style="font-size: 2.5rem; margin: 10px 0;">❤️ ${likedCats.length} / ${cats.length}</p>
        <p style="opacity: 0.9;">${percentage}% match rate</p>
    `;
}

/**
 * Displays grid of liked cats or message if none were liked
 */
function displayLikedCats() {
    const likedCatsContainer = document.getElementById('likedCats');
    likedCatsContainer.innerHTML = '';
    
    if (likedCats.length === 0) {
        // Show message when no cats were liked
        likedCatsContainer.innerHTML = 
            '<div class="no-cats-message">No cats liked yet. Maybe they weren\'t your type? 😿<br>Give it another try!</div>';
    } else {
        // Create grid of liked cat images using cached data
        likedCats.forEach((catIndex) => {
            const img = document.createElement('img');
            img.src = catImages[catIndex] || cats[catIndex];
            img.alt = `Liked cat ${catIndex + 1}`;
            img.title = `Cat #${catIndex + 1}`;
            img.loading = 'lazy'; // Lazy load for better performance
            likedCatsContainer.appendChild(img);
        });
    }
}

// ============ APPLICATION START ============
// Initialize the app when the script loads
init();