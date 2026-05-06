import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Button } from "react-bootstrap";

//CSS
import "./SearchBox.css";

const SearchBox = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState("Title");

  const submitHandler = (e) => {
    e.preventDefault();
    if (keyword.trim()) {
      const q = encodeURIComponent(keyword.trim());
      navigate(`/products/search/${q}/${filter.toLowerCase()}`);
      setKeyword("");
    } else {
      navigate("/products");
    }
  };

  return (
    <Form
      onSubmit={submitHandler}
      className="d-flex align-items-center header-search-form"
    >
      <fieldset className="header-search-fieldset">
        <legend className="sr-only">Product search</legend>
        <Form.Label htmlFor="header-search-filter" className="sr-only">
          Field to search (for example title or brand)
        </Form.Label>
        <Form.Control
          id="header-search-filter"
          className="header__select"
          size="sm"
          as="select"
          aria-label="Choose search field"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
          }}
        >
          <option>Title</option>
          <option>Brand</option>
          <option>Size</option>
          <option>Gender</option>
          <option>Category</option>
          <option>Color</option>
          <option>Description</option>
        </Form.Control>
        <Form.Label htmlFor="header-search-q" className="sr-only">
          Search products by keyword
        </Form.Label>
        <Form.Control
          id="header-search-q"
          type="text"
          placeholder={`Search by ${filter}...`}
          name="q"
          onChange={(e) => setKeyword(e.target.value)}
          className="header__search-box"
          autoComplete="off"
          value={keyword}
          size="sm"
        />

        <Button
          type="submit"
          variant="secondary"
          className="p-2 btn-sm py-0"
          aria-label="Submit product search"
        >
          Search
        </Button>
      </fieldset>
    </Form>
  );
};

export default SearchBox;
