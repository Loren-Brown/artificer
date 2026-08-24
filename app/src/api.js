/**
 * Client resume API — same method names as the old HTTP client.
 */

import { getResumeApi } from "./clientRuntime.js";

function wrap(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err.status === 422 && err.body) return err.body;
      throw err;
    }
  };
}

export async function listResumes() {
  return getResumeApi().listResumes();
}

export async function getPublicResumeStatus() {
  return getResumeApi().getPublicResumeStatus();
}

export async function getPublicResumeText() {
  return getResumeApi().getPublicResumeText();
}

export async function getResumeHistory(name) {
  return getResumeApi().getResumeHistory(name);
}

export const undoResume = wrap((name) => getResumeApi().undoResume(name));
export const redoResume = wrap((name) => getResumeApi().redoResume(name));
export const selectResume = wrap((name) => getResumeApi().selectResume(name));
export const compileSelectedResume = wrap(() =>
  getResumeApi().compileSelectedResume(),
);

export async function storeResume(filename, content) {
  return getResumeApi().storeResume(filename, content);
}

export function subscribePublicResumeWebhook(channel, onEvent) {
  const resume = getResumeApi();
  const map = {
    latex: "resume:updated",
    pdf: "pdf:ready",
    html: "resume:updated",
  };
  const event = map[channel] || "resume:updated";
  const unsub = resume.bus.on(event, () => {
    onEvent?.({ type: channel });
  });
  return { close: () => unsub() };
}

export function subscribePublicResumeLatexWebhook(onEvent) {
  return subscribePublicResumeWebhook("latex", onEvent);
}

export function subscribePublicResumePdfWebhook(onEvent) {
  return subscribePublicResumeWebhook("pdf", onEvent);
}

export function subscribePublicResumeHtmlWebhook(onEvent) {
  return subscribePublicResumeWebhook("html", onEvent);
}

export async function downloadPublicResumePdf(filename = "resume.pdf") {
  const bytes = await getResumeApi().getPublicResumePdfBytes();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPublicResumeLatex(filename = "resume.tex") {
  const text = await getResumeApi().getPublicResumeText();
  const blob = new Blob([text], { type: "application/x-tex" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Object URL for PDF preview (caller should revoke). */
export async function publicResumePdfPreviewUrl() {
  const bytes = await getResumeApi().getPublicResumePdfBytes();
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

export function publicResumeHtmlPreviewUrl() {
  return null;
}

export async function listItems(type) {
  return getResumeApi().listItems(type);
}

export async function getItem(type, index) {
  return getResumeApi().getItem(type, index);
}

export async function createItem(type, item) {
  return getResumeApi().createItem(type, item);
}

export async function updateItem(type, index, item) {
  return getResumeApi().updateItem(type, index, item);
}

export async function deleteItem(type, index) {
  return getResumeApi().deleteItem(type, index);
}

export async function reorderItems(type, indexes) {
  return getResumeApi().reorderItems(type, indexes);
}

export async function getGeneral() {
  return getResumeApi().getGeneral();
}

export async function putGeneral(data) {
  return getResumeApi().putGeneral(data);
}

export async function getSkills() {
  return getResumeApi().getSkills();
}

export async function putSkills(data) {
  return getResumeApi().putSkills(data);
}

export async function listSkillCategories() {
  return getResumeApi().listSkillCategories();
}

export async function createSkillCategory(item) {
  return getResumeApi().createSkillCategory(item);
}

export async function updateSkillCategory(index, item) {
  return getResumeApi().updateSkillCategory(index, item);
}

export async function deleteSkillCategory(index) {
  return getResumeApi().deleteSkillCategory(index);
}

export async function reorderSkillCategories(indexes) {
  return getResumeApi().reorderSkillCategories(indexes);
}
