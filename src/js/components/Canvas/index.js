import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as dat from "dat.gui";
import AutoBind from "../../utils/bind";
import MersenneTwister from "mersenne-twister";

// Bugs parameters (using similar ranges to your original code)
const NUM_BUGS = 10;
const BUG_SPAWN_RANGE = 20.0;

const TERRAIN_HEIGHT = 1;
const TERRAIN_OFFSET = 0.75;
const TERRAIN_DIMS = 10000;

// Movement parameters for randomness
const MAX_SPEED = 0.02; // adjust to taste

export default class Canvas {
  constructor() {
    AutoBind(this);

    this.gui = new dat.GUI();
    this.canvas = document.querySelector("canvas.webgl");
    this.scene = new THREE.Scene();
    this.textureLoader = new THREE.TextureLoader();

    this.sizes = this.windowSize;
    this.clock = new THREE.Clock();
    this.pointer = new THREE.Vector2();

    this.group = new THREE.Group();
    this.shader = null;
    this.totalTime = 0;

    this.cursor = {
      x: 0,
      y: 0,
    };

    // Dummy object for setting instance matrices
    this.dummy = new THREE.Object3D();

    // Arrays to store each bug’s position and velocity
    this.bugPositions = [];
    this.bugVelocities = [];

    // Initialize the raycaster
    this.raycaster = new THREE.Raycaster();
  }

  async init() {
    this.createCamera();
    this.createRenderer();
    this.createLight();
    await this.createBugs();

    // Add a mousemove event listener to update pointer position.
    window.addEventListener("mousemove", this.onPointerMove);

    this.previousRAF_ = null;
    this.raf_();

    this.createRaycaster();
  }

  get windowSize() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  createCamera() {
    this.cameraGroupMouse = new THREE.Group();
    this.scene.add(this.cameraGroupMouse);
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.sizes.width / this.sizes.height,
      0.1,
      100
    );

    this.camera.position.set(2, 3.3, -1.02);
    this.camera.rotation.set(1.685, 1.39, -1.69);
    this.scene.add(this.camera);
    this.cameraGroupMouse.add(this.camera);
  }

  createRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  createLight() {
    const light = new THREE.DirectionalLight(0xffffff, 1.0);
    light.position.set(1, 1, 1);
    light.lookAt(0, 0, 0);
    this.scene.add(light);
  }

  loadAssets() {
    const gltfLoader = new GLTFLoader();

    gltfLoader.load("test.glb", (gltf) => {
      gltf.scene.scale.set(0.05, 0.05, 0.05);
      this.shape = gltf.scene;
      this.animation = gltf.animations[0];
      this.mixer = new THREE.AnimationMixer(this.shape);
      this.action = this.mixer.clipAction(this.animation);

      this.action.setLoop(THREE.LoopOnce);
      this.action.clampWhenFinished = true;
      this.action.enable = true;
      this.action.play();

      this.scene.add(this.shape);
    });
  }

  createMesh() {
    this.uniforms = {
      uTexture: { value: null },
      uOffset: { value: new THREE.Vector2(0, 0) },
      uAlpha: { value: 1.0 },
    };

    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });

    this.geometry = new THREE.PlaneGeometry(1, 1, 100, 100);

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
  }

  async createBugs() {
    // Load shaders
    const vshBug = await fetch("/shaders/bug-vertex-shader.glsl");
    const fshBug = await fetch("/shaders/bug-fragment-shader.glsl");
    const vshBugText = await vshBug.text();
    const fshBugText = await fshBug.text();

    // Load textures
    this.butterflyTexture = new THREE.TextureLoader().load(
      "/textures/null-butterfly.png"
    );
    this.butterflyTexture.colorSpace = THREE.SRGBColorSpace;

    this.mothTexture = new THREE.TextureLoader().load("/textures/moth.png");
    this.mothTexture.colorSpace = THREE.SRGBColorSpace;

    const heightmapTexture = new THREE.TextureLoader().load(
      "/textures/terrain.png"
    );

    // Create a Phong material and modify its shader
    this.bugsMaterial = new THREE.MeshPhongMaterial({
      map: this.butterflyTexture,
      shininess: 0,
      alphaTest: 0.5,
      // side: THREE.DoubleSide, // enable if needed
    });

    this.bugsMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.time = { value: 0 };
      shader.uniforms.bugsTexture = { value: this.butterflyTexture };
      shader.uniforms.resolution = { value: new THREE.Vector2(1, 1) };
      shader.uniforms.bugsSize = { value: new THREE.Vector2(0.5, 1.25) };
      shader.uniforms.heightmap = { value: heightmapTexture };
      shader.uniforms.heightmapParams = {
        value: new THREE.Vector3(TERRAIN_HEIGHT, TERRAIN_OFFSET, TERRAIN_DIMS),
      };

      shader.vertexShader = vshBugText;
      shader.fragmentShader = fshBugText;
      this.shader = shader;
    };

    // Create a plane geometry for the bug and rotate it to lie flat
    const bugGeo = new THREE.PlaneGeometry(10, 10, 2, 2);
    bugGeo.rotateX(-Math.PI / 2);

    // Create an InstancedMesh with NUM_BUGS instances
    this.bugsMesh_ = new THREE.InstancedMesh(
      bugGeo,
      this.bugsMaterial,
      NUM_BUGS
    );
    this.bugsMesh_.receiveShadow = true;
    this.bugsMesh_.castShadow = false;

    // Use MersenneTwister to generate random positions and velocities for each bug
    const rng = new MersenneTwister(1);
    for (let i = 0; i < NUM_BUGS; i++) {
      // Random initial position (similar to original code)
      const pos = new THREE.Vector3(
        (rng.random() * 2.0 - 1.0) * (BUG_SPAWN_RANGE / 2),
        rng.random() * 1.0 + 2.0,
        (rng.random() * 2.0 - 1.0) * (BUG_SPAWN_RANGE / 2)
      );
      this.bugPositions.push(pos);

      // Random velocity direction and speed
      const vel = new THREE.Vector3(
        rng.random() * 2.0 - 1.0,
        0, // keeping y constant to simulate bugs on a flat plane; adjust if needed
        rng.random() * 2.0 - 1.0
      );
      // Normalize and scale to a random speed up to MAX_SPEED
      vel.normalize().multiplyScalar(rng.random() * MAX_SPEED);
      this.bugVelocities.push(vel);

      // Set the initial matrix for the instance
      this.dummy.position.copy(pos);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.bugsMesh_.setMatrixAt(i, this.dummy.matrix);
    }

    this.group.add(this.bugsMesh_);
    this.scene.add(this.group);
  }

  createRaycaster() {
    // Already initialized in the constructor.
  }

  onPointerMove(event) {
    const sizes = this.windowSize;
    // Convert mouse coordinates to normalized device coordinates (-1 to +1)
    this.pointer.x = (event.clientX / sizes.width) * 2 - 1;
    this.pointer.y = -(event.clientY / sizes.height) * 2 + 1;
  }

  raf_() {
    requestAnimationFrame((t) => {
      if (this.previousRAF_ === null) {
        this.previousRAF_ = t;
      }
      this.render(t - this.previousRAF_);
      this.raf_();
      this.previousRAF_ = t;
    });
  }

  render(elapsedTime) {
    if (this.controls) {
      this.controls.update();
    }

    // Update bug positions based on their velocities
    for (let i = 0; i < this.bugsMesh_.count; i++) {
      // Update stored position
      this.bugPositions[i].add(this.bugVelocities[i]);

      // Wrap-around logic for x and z axes
      ["x", "z"].forEach((axis) => {
        if (this.bugPositions[i][axis] > BUG_SPAWN_RANGE / 2) {
          this.bugPositions[i][axis] = -BUG_SPAWN_RANGE / 2;
        } else if (this.bugPositions[i][axis] < -BUG_SPAWN_RANGE / 2) {
          this.bugPositions[i][axis] = BUG_SPAWN_RANGE / 2;
        }
      });

      // Update the transformation matrix for this instance
      this.dummy.position.copy(this.bugPositions[i]);
      this.dummy.rotation.set(0, this.totalTime + i, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.bugsMesh_.setMatrixAt(i, this.dummy.matrix);
    }
    this.bugsMesh_.instanceMatrix.needsUpdate = true;

    // Update the shader's time uniform
    this.totalTime += elapsedTime * 0.0005;
    if (this.shader) {
      this.shader.uniforms.time.value = this.totalTime;
    }

    // Update the raycaster and check for intersections with the instanced mesh
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObject(this.bugsMesh_);
    if (intersects.length > 0) {
      const hoveredInstance = intersects[0].instanceId;
      console.log(`Hovered on butterfly instance: ${hoveredInstance}`);
    }

    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.sizes.width = window.innerWidth;
    this.sizes.height = window.innerHeight;

    this.camera.aspect = this.sizes.width / this.sizes.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  onTouchMove(event) {
    const sizes = this.windowSize;
    const x = event.touches ? event.touches[0].clientX : event.clientX;
    const y = event.touches ? event.touches[0].clientY : event.clientY;

    this.cursor.x = x / sizes.width - 0.5;
    this.cursor.y = y / sizes.height - 0.5;

    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }
}
