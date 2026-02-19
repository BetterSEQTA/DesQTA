<script lang="ts">
  import Cropper from 'svelte-easy-crop';
  import Modal from './Modal.svelte';
  import { Button } from '$lib/components/ui';
  import T from './T.svelte';
  import { _ } from '../i18n';

  interface CropArea {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  interface Props {
    open: boolean;
    imageSrc: string | null;
    onsave: (croppedBase64: string) => void;
    oncancel: () => void;
  }

  let { open, imageSrc, onsave, oncancel }: Props = $props();

  let crop = $state({ x: 0, y: 0 });
  let zoom = $state(1);
  let saving = $state(false);

  async function createCroppedImage(src: string, pixelCrop: CropArea): Promise<string> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          pixelCrop.width,
          pixelCrop.height
        );
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = () => reject(new Error('Failed to load image'));
      image.src = src;
    });
  }

  async function handleCropComplete(event: { percent: CropArea; pixels: CropArea }) {
    if (!imageSrc || saving) return;
    saving = true;
    try {
      const croppedBase64 = await createCroppedImage(imageSrc, event.pixels);
      onsave(croppedBase64);
      oncancel();
    } catch (error) {
      console.error('Failed to crop image:', error);
    } finally {
      saving = false;
    }
  }

  function handleSave() {
    // Trigger crop by calling handleCropComplete - we need the latest crop data
    // The Cropper emits on drag/zoom end. We'll use a ref to get current crop.
    // Actually, we need to manually trigger - the cropper doesn't have a "get current crop" method.
    // We need to store the last cropcomplete event and use it when Save is clicked.
    if (lastCropData && imageSrc && !saving) {
      handleCropComplete(lastCropData);
    }
  }

  let lastCropData = $state<{ percent: CropArea; pixels: CropArea } | null>(null);

  function onCropComplete(event: { percent: CropArea; pixels: CropArea }) {
    lastCropData = event;
  }
</script>

<Modal
  {open}
  title={$_('settings.crop_profile_picture') || 'Crop Profile Picture'}
  maxWidth="max-w-2xl"
  onclose={oncancel}
  ariaLabel={$_('settings.crop_profile_picture') || 'Crop profile picture'}>
  <div class="flex flex-col gap-4 p-6">
    {#if imageSrc}
      <div class="relative h-80 w-full overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800">
        <Cropper
          image={imageSrc}
          bind:crop
          bind:zoom
          aspect={1}
          cropShape="round"
          showGrid={true}
          minZoom={0.5}
          maxZoom={3}
          oncropcomplete={onCropComplete}
        />
      </div>
      <div class="flex justify-end gap-3">
        <Button
          variant="ghost"
          onclick={oncancel}
          disabled={saving}>
          <T key="common.cancel" fallback="Cancel" />
        </Button>
        <Button
          variant="primary"
          onclick={handleSave}
          disabled={saving || !lastCropData}>
          {saving
            ? ($_('settings.saving') || 'Saving...')
            : ($_('settings.save_crop') || 'Save')}
        </Button>
      </div>
    {/if}
  </div>
</Modal>
