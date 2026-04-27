import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "src", "data", "vehicles.json");

let writeQueue = Promise.resolve();

function withLock(fn) {
  const next = writeQueue.then(fn, fn);
  writeQueue = next.catch(() => {});
  return next;
}

export function readVehicles() {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeVehicles(vehicles) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(vehicles, null, 2), "utf-8");
}

export function addVehicle(vehicle) {
  return withLock(() => {
    const vehicles = readVehicles();
    vehicles.push(vehicle);
    writeVehicles(vehicles);
    return vehicle;
  });
}

export function updateVehicle(id, data) {
  return withLock(() => {
    const vehicles = readVehicles();
    const idx = vehicles.findIndex((v) => v.id === id);
    if (idx === -1) return null;
    vehicles[idx] = { ...vehicles[idx], ...data };
    writeVehicles(vehicles);
    return vehicles[idx];
  });
}

export function deleteVehicle(id) {
  return withLock(() => {
    const vehicles = readVehicles();
    const idx = vehicles.findIndex((v) => v.id === id);
    if (idx === -1) return false;
    vehicles.splice(idx, 1);
    writeVehicles(vehicles);
    return true;
  });
}

export function getVehicleById(id) {
  return readVehicles().find((v) => v.id === id) || null;
}
