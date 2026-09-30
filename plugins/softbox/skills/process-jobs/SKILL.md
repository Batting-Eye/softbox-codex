---
name: process-jobs
description: "Process queued Softbox image jobs. Use when the user asks to handle, run or generate pending Softbox jobs or requests."
---

# Process Softbox jobs

Call softbox_next_job to take the next job. If it says there is no queued job, tell the user.
If it says the device is not connected, call softbox_connect and ask the user to approve in the browser.

How to process this Softbox job (follow exactly):
1. Use only Codex's built-in image generation. Do not use skills, workflows or tools from other plugins for this job, even if one looks related (for example a face variation lab).
2. Use recipe.brief word for word as the prompt; do not shorten or paraphrase it. After it, add one line naming each reference image in the order you pass them (for example "Reference image 1 is BASE. Reference image 2 is the layout reference (framing only). Reference image 3 is the Eye reference, an eye-region crop.") and one line "This is image N of requestedCount." so the brief's direction N applies.
3. Pass reference images in this order: "base" first; then the one layout reference (layout_female or layout_male) that matches the BASE person's gender; then the parts from the highest strength in recipe.parts. At most 5 per generation call: if there are more, leave out the layout reference first (BASE already has the same framing), then the parts with the lowest strength.
4. Make requestedCount separate images, one at a time. Each must be a different face that follows the brief.
5. Right after each image is made, call softbox_add_image with the runId, its slot (1 for the first, 2 for the second, …) and the file path, before making the next one. The user watches them appear one by one. Files must be PNG, JPEG or WEBP under 10 MB. Do not edit the reference files.
6. When done, call softbox_submit with the runId and an empty files list. If some images could not be made, give a short reason.

Repeat until softbox_next_job reports no more queued jobs, then summarize what was uploaded.
