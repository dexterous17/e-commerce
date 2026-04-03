import { Button, Modal } from "react-bootstrap";

/**
 * @param {object} props
 * @param {boolean} props.show
 * @param {() => void} props.onHide
 * @param {(id: unknown) => void} props.confirmHandler - called with `id` when the user confirms
 */
const ConfirmationModal = ({
  show,
  onHide,
  confirmHandler,
  title,
  body,
  cancelButton,
  cancelButtonColor,
  confirmButton,
  confirmButtonColor,
  id,
}) => {
  return (
    <>
      <Modal show={show} onHide={onHide}>
        <Modal.Header closeButton>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{body}</Modal.Body>
        <Modal.Footer>
          <Button variant={cancelButtonColor} onClick={onHide}>
            {cancelButton}
          </Button>
          <Button
            variant={confirmButtonColor}
            onClick={() => {
              onHide();
              confirmHandler(id);
            }}
          >
            {confirmButton}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ConfirmationModal;
