import { Row, Col } from "react-bootstrap";

/** Render inside App `ContainerLayout` (Bootstrap `.container`). Uses Row + Col only to avoid nested containers. */
const FormContainer = ({ children }) => {
  return (
    <Row className="justify-content-md-center form-screen">
      <Col xs={12} md={6}>
        {children}
      </Col>
    </Row>
  );
};

export default FormContainer;
