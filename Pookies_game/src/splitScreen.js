// One canvas, one viewport per camera: two side-by-side halves for two players, or the
// whole screen when there is only one.
export function createSplitScreen(renderer, scene, cameras) {
  renderer.autoClear = false;
  renderer.setScissorTest(true);

  let views = cameras;

  function render() {
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;
    if (width === 0 || height === 0) return;

    const single = views.length === 1;
    const half = Math.floor(width / 2);

    views.forEach((camera, index) => {
      const x = single ? 0 : index === 0 ? 0 : half;
      const viewWidth = single ? width : index === 0 ? half : width - half;

      const aspect = viewWidth / height;
      if (camera.aspect !== aspect) {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      }

      renderer.setViewport(x, 0, viewWidth, height);
      renderer.setScissor(x, 0, viewWidth, height);
      renderer.clear();
      renderer.render(scene, camera);
    });
  }

  return {
    render,
    // Swap between one and two viewports when the session starts.
    setCameras(next) {
      views = next;
    },
  };
}
