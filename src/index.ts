import { GraphicsDevice } from "./grahpic-device";

console.log("Bloody Engine initialized!");
const gdevice = new GraphicsDevice(800, 600);

// Demonstrate the standardized interface
console.log(`Browser environment: ${gdevice.isBrowser()}`);
console.log(`Viewport: ${gdevice.getWidth()}x${gdevice.getHeight()}`);
console.log(`Context type: ${gdevice.getRenderingContext().constructor.name}`);
