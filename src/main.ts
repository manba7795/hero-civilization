import "./styles.css";
import { Game } from "./core/Game";

const viewport = document.querySelector<HTMLElement>("#viewport");
if (!viewport) throw new Error("Missing #viewport");

const game = new Game(viewport);

document.querySelector<HTMLButtonElement>("#end-turn")?.addEventListener("click", () => {
  game.events.emit("command:end-turn", undefined);
});

Object.assign(window, { game });
