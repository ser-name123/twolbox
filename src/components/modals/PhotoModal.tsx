import Modal from "./Modal";

export type PhotoView = { title: string; src: string } | null;

export default function PhotoModal({ photo, onClose }: { photo: PhotoView; onClose: () => void }) {
  if (!photo) return null;
  return (
    <Modal open boxStyle={{ textAlign: "center" }}>
      <h2 style={{ fontSize: 15 }}>{photo.title}</h2>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL from storage */}
      <img src={photo.src} style={{ maxWidth: "100%", borderRadius: 8, marginTop: 8 }} alt="Product photo" />
      <button className="btn-secondary" style={{ width: "100%", marginTop: 14 }} onClick={onClose}>
        Close
      </button>
    </Modal>
  );
}
