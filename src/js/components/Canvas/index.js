import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as dat from "dat.gui";
import AutoBind from "../../utils/bind";
import vertexShader from "./shaders/vertex.glsl";
import fragmentShader from "./shaders/fragment.glsl";

export default class Canvas {
  constructor() {
    AutoBind(this);

    this.gui = new dat.GUI();
    this.canvas = document.querySelector("canvas.webgl");
    this.scene = new THREE.Scene();
    this.textureLoader = new THREE.TextureLoader();

    this.sizes = this.windowSize;
    this.clock = new THREE.Clock();

    this.cursor = {
      x: 0,
      y: 0,
    };

    this.createCamera();
    this.createRenderer();
    this.createMesh();
    this.loadAssets();
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
    this.camera.position.set(0.25, -0.25, 1);
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

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.enabled = false;
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

    // Material

    this.material = new THREE.ShaderMaterial({
      fragmentShader,
      vertexShader,
      uniforms: this.uniforms,
    });

    // Geometry
    this.geometry = new THREE.PlaneGeometry(1, 1, 100, 100);

    // Mesh
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    // this.scene.add(this.mesh);
  }

  onResize() {
    this.sizes.width = window.innerWidth;
    this.sizes.height = window.innerHeight;

    // Update camera
    this.camera.aspect = this.sizes.width / this.sizes.height;
    this.camera.updateProjectionMatrix();

    // Update renderer
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  onTouchMove(event) {
    const sizes = this.windowSize;
    const x = event.touches ? event.touches[0].clientX : event.clientX;
    const y = event.touches ? event.touches[0].clientY : event.clientY;

    this.cursor.x = x / sizes.width - 0.5;
    this.cursor.y = y / sizes.height - 0.5;
  }

  render() {
    this.controls.update();

    // Render
    this.renderer.render(this.scene, this.camera);

    const parallaxX = -this.cursor.x;
    const parallaxY = -this.cursor.y;

    this.cameraGroupMouse.rotation.y +=
      (parallaxX - this.cameraGroupMouse.rotation.y) * 0.1;

    this.cameraGroupMouse.rotation.x +=
      (parallaxY - this.cameraGroupMouse.rotation.x) * 0.1;

    // if (this.shouldPlay) {
    this.mixer?.update(this.clock.getDelta());
    // }
  }
}
