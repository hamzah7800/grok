// Three.js setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a simple arena (ground plane)
const groundGeometry = new THREE.PlaneGeometry(50, 50);
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; // Lay flat
scene.add(ground);

// Camera position
camera.position.set(0, 10, 15);
camera.lookAt(0, 0, 0);

// Player data
const players = {};
let localPlayer = null;
let playerId = Math.random().toString(36).substring(2, 15); // Unique ID for local player
let gameCode = null;

// WebSocket setup (replace with your WebSocket server URL)
const socket = new WebSocket('wss://free-socket-server.herokuapp.com'); // Placeholder, see notes below

// Handle WebSocket connection
socket.onopen = () => {
    console.log('Connected to WebSocket server');
};

// Handle incoming messages
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'init') {
        // Initialize other players
        Object.keys(data.players).forEach(id => {
            if (id !== playerId && data.players[id].gameCode === gameCode) {
                addPlayer(id, data.players[id].position, data.players[id].color);
            }
        });
    } else if (data.type === 'update') {
        // Update player position
        if (data.id !== playerId && players[data.id] && data.gameCode === gameCode) {
            players[data.id].position.set(data.position.x, data.position.y, data.position.z);
        }
    } else if (data.type === 'remove') {
        // Remove player
        if (players[data.id] && data.gameCode === gameCode) {
            scene.remove(players[data.id]);
            delete players[data.id];
        }
    }
};

// Create a player cube
function addPlayer(id, position, color) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(position.x, position.y, position.z);
    scene.add(cube);
    players[id] = cube;
}

// Join game with game code
function joinGame() {
    gameCode = document.getElementById('gameCode').value || 'default';
    if (!localPlayer) {
        // Create local player
        const color = Math.random() * 0xffffff;
        localPlayer = addPlayer(playerId, { x: 0, y: 0.5, z: 0 }, color);
        socket.send(JSON.stringify({
            type: 'join',
            id: playerId,
            gameCode: gameCode,
            position: { x: 0, y: 0.5, z: 0 },
            color: color
        }));
        document.getElementById('ui').style.display = 'none'; // Hide UI after joining
    }
}

// Player movement
const keys = {};
document.addEventListener('keydown', (e) => { keys[e.key] = true; });
document.addEventListener('keyup', (e) => { keys[e.key] = false; });

function updatePlayer() {
    if (!localPlayer) return;
    const speed = 0.1;
    if (keys['ArrowUp'] || keys['w']) localPlayer.position.z -= speed;
    if (keys['ArrowDown'] || keys['s']) localPlayer.position.z += speed;
    if (keys['ArrowLeft'] || keys['a']) localPlayer.position.x -= speed;
    if (keys['ArrowRight'] || keys['d']) localPlayer.position.x += speed;

    // Keep player above ground
    localPlayer.position.y = 0.5;

    // Send position update
    socket.send(JSON.stringify({
        type: 'update',
        id: playerId,
        gameCode: gameCode,
        position: {
            x: localPlayer.position.x,
            y: localPlayer.position.y,
            z: localPlayer.position.z
        }
    }));
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
    socket.send(JSON.stringify({
        type: 'leave',
        id: playerId,
        gameCode: gameCode
    }));
});
