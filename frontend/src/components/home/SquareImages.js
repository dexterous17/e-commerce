// import { Container, Row, Col, Image } from "react-bootstrap";

//CSS
import "./SquareImages.css";

const SquareImages = () => {

  const images = [
    {
      "src": "../../uploads/image_140.jpeg",
      "alt": "Gallery 1",
      "className": "gallery__item gallery__item--1"
    },
    {
      "src": "../../uploads/image_191.jpg",
      "alt": "Gallery 2",
      "className": "gallery__item gallery__item--2"
    },
    {
      "src": "../../uploads/image_516.jpg",
      "alt": "Gallery 3",
      "className": "gallery__item gallery__item--3"
    },
    {
      "src": "../../uploads/image_671.jpg",
      "alt": "Gallery 4",
      "className": "gallery__item gallery__item--4"
    },
    {
      "src": "../../uploads/image_745.jpg",
      "alt": "Gallery 5",
      "className": "gallery__item gallery__item--5"
    },
    {
      "src": "../../uploads/image_840.jpg",
      "alt": "Gallery 6",
      "className": "gallery__item gallery__item--6"
    },
    {
      "src": "../../uploads/image_1032.jpg",
      "alt": "Gallery 7",
      "className": "gallery__item gallery__item--7"
    },
    {
      "src": "../../uploads/image_1359.jpg",
      "alt": "Gallery 8",
      "className": "gallery__item gallery__item--8"
    },
    {
      "src": "../../uploads/image_1393.jpg",
      "alt": "Gallery 9",
      "className": "gallery__item gallery__item--9"
    },
    {
      "src": "../../uploads/image_1545.jpg",
      "alt": "Gallery 10",
      "className": "gallery__item gallery__item--10"
    },
    {
      "src": "../../uploads/image_1609.jpg",
      "alt": "Gallery 11",
      "className": "gallery__item gallery__item--11"
    },
    {
      "src": "../../uploads/image_1626.jpg",
      "alt": "Gallery 12",
      "className": "gallery__item gallery__item--12"
    },
    {
      "src": "../../uploads/tay14.jpg",
      "alt": "Gallery 13",
      "className": "gallery__item gallery__item--13"
    },
    {
      "src": "../../uploads/tay2.jpg",
      "alt": "Gallery 14",
      "className": "gallery__item gallery__item--14"
    }
  ]
  return (
    <div>
      <div className="welcome-box">
        <h2>Welcome to my shop!</h2>
        <h1>Tailored by Harshil</h1>
      </div>
      <div className="gallery">
        {images.map((image, index) => (

          <figure key={index} className={image.className}>
            <img
              src={image.src}
              alt={image.alt}
              className="gallery__img"
            />
          </figure>

        ))}
      </div>
    </div>
  );
};

export default SquareImages;
