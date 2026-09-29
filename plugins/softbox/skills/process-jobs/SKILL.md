---
name: process-jobs
description: "Process queued Softbox image jobs. Use when the user asks to handle, run or generate pending Softbox jobs or requests."
---

# Process Softbox jobs

Call softbox_next_job to take the next job. If it says there is no queued job, tell the user.
If it says the device is not connected, call softbox_connect and ask the user to approve in the browser.

How to process this Softbox job (follow exactly):
1. Use only Codex's built-in image generation. Do not use skills, workflows or tools from other plugins for this job, even if one looks related (for example a face variation lab).
2. Follow recipe.brief as the prompt. Each reference's role says what it is for: "base" is the face to start from; hair, brows, eyes, nose and mouth are the parts to borrow.
3. Pass at most 5 reference images to one generation call. Always keep "base"; if there are more than 5, drop the parts with the lowest strength in recipe.parts.
4. Make requestedCount separate images. Each must be a different face that follows the brief.
5. Save them as PNG, JPEG or WEBP files under 10 MB. Do not edit the reference files.
6. Call softbox_submit with the runId and the file paths in order. If some images could not be made, submit the ones you have and give a short reason.

Repeat until softbox_next_job reports no more queued jobs, then summarize what was uploaded.
