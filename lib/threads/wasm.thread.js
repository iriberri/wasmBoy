// Our thread for interating with our wasm instances
import threads from 'threads';
const spawn = threads.spawn;

const thread = spawn((input, done) => {
  // Get our event
  if (input.event === 'INSTANTIATE_WASM') {
  }
});
