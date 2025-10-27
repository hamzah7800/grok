// Three.js setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Arena
const groundGeometry = new THREE.PlaneGeometry(50, 50);
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Camera
camera.position.set(0, 10, 15);
camera.lookAt(0, 0, 0);

// Player data
const players = {};
let localPlayer = null;
const playerId = Math.random().toString(36).substring(2, 15); // Unique ID
let gameCode = null;
let channel = null;

// Pusher setup
const PUSHER_KEY = 'f0521186a6ab26cc4e05'; // Your Pusher app key
const PUSHER_CLUSTER = 'eu'; // Your Pusher cluster
Pusher.logToConsole = true; // Enable logging for debugging (remove in production)
const pusher = new Pusher(PUSHER_KEY, {
    cluster: PUSHER_CLUSTER
});
const channelPrefix = 'game-'; // For rooms like 'game-room1'

// Create a player cube
function addPlayer(id, position, color) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(position.x, position.y, position.z);
    scene.add(cube);
    players[id] = cube;
    return cube;
}

// Join game with game code
function joinGame() {
    gameCode = document.getElementById('gameCode').value.toLowerCase().replace(/\s/g, '') || 'default';
    channel = pusher.subscribe(channelPrefix + gameCode);

    if (!localPlayer) {
        const color = Math.random() * 0xffffff;
        localPlayer = addPlayer(playerId, { x: 0, y: 0.5, z: 0 }, color);
        channel.trigger('client-join', {
            id: playerId,
            position: { x: 0, y: 0.5, z: 0 },
            color: color
        });
        document.getElementById('ui').style.display = 'none';
    }

    // Handle incoming events
    channel.bind('client-join', (data) => {
        if (data.id !== playerId) {
            addPlayer(data.id, data.position, data.color);
        }
    });

    channel.bind('client-update', (data) => {
        if (data.id !== playerId && players[data.id]) {
            players[data.id].position.set(data.position.x, data.position.y, data.position.z);
        }
    });

    channel.bind('client-leave', (data) => {
        if (players[data.id]) {
            scene.remove(players[data.id]);
            delete players[data.id];
        }
    });
}

// Player movement
const keys = {};
document.addEventListener('keydown', (e) => { keys[e.key] = true; });
document.addEventListener('keyup', (e) => { keys[e.key] = false; });

let lastUpdate = 0;
function updatePlayer() {
    if (!localPlayer || !channel) return;
    const now = Date.now();
    if (now - lastUpdate < 100) return; // Throttle to 100ms to respect Pusher limits
    lastUpdate = now;

    const speed = 0.1;
    if (keys['ArrowUp'] || keys['w']) localPlayer.position.z -= speed;
    if (keys['ArrowDown'] || keys['s']) localPlayer.position.z += speed;
    if (keys['ArrowLeft'] || keys['a']) localPlayer.position.x -= speed;
    if (keys['ArrowRight'] || keys['d']) localPlayer.position.x += speed;
    localPlayer.position.y = 0.5;

    // Send position update
    channel.trigger('client-update', {
        id: playerId,
        position: {
            x: localPlayer.position.x,
            y: localPlayer.position.y,
            z: localPlayer.position.z
        }
    });
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    updatePlayer();
    renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Handle player disconnect
window.addEventListener('beforeunload', () => {
    if (channel) {
        channel.trigger('client-leave', { id: playerId });
        pusher.unsubscribe(channelPrefix + gameCode);
    }
});
