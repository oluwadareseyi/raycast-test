import * as THREE from "three";
import Canvas from "./components/Canvas";

const canvas = new Canvas();
const clock = new THREE.Clock();

const render = () => {
  const elapsedTime = clock.getElapsedTime();

  // Update canvas
  canvas.render(elapsedTime);

  // Call render again on the next frame
  window.requestAnimationFrame(render);
};

await canvas.init();
// render();

// resize event
window.addEventListener("resize", () => {
  canvas.onResize();
});

window.addEventListener("mousemove", canvas.onTouchMove, { passive: true });
window.addEventListener("touchmove", canvas.onTouchMove, { passive: true });

// Render

// if (this.raycaster) {
//   this.raycaster.setFromCamera(this.pointer, this.camera);
//   const intersects = this.raycaster.intersectObjects(
//     this.group.children,
//     true
//   );

//   if (intersects.length > 0) {
//     // console.log(intersects[0].object.position);
//     intersects[0].object.material.map = this.mothTexture;
//   } else {
//     // intersects[0].object.material.map = this.butterflyTexture;
//   }
// }
