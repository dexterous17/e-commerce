import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Form, Button } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";

//components
import Message from "../components/Message";
import BunnyLoader from "../components/BunnyLoader";
import FormContainer from "../components/FormContainer";
import Meta from "../components/Meta";

//actions
import { login } from "../store/actions/userActions";

const LoginScreen = () => {
  //component state that will hold the email and password
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = useMemo(() => {
    const raw = searchParams.get("redirect") || "/";
    return raw.startsWith("/") ? raw : `/${raw}`;
  }, [searchParams]);

  const dispatch = useDispatch();

  const userLogin = useSelector((state) => state.userLogin);
  const { loading, error, userInfo } = userLogin;

  //if the user is already logged in, then apply a redirect so they do not see the login screen again
  //they would head directly to the shipping page if they are already logged in
  useEffect(() => {
    //if we are not logged in then userInfo will be null
    if (userInfo) {
      navigate(redirect, { replace: true });
    }
  }, [navigate, userInfo, redirect]);

  //handle submit button
  const submitHandler = (e) => {
    e.preventDefault();
    //call action creater with email and password state that the user provided
    dispatch(login(email, password));
  };

  return (
    <FormContainer>
      <Meta title="Tailored by Boutique - Login" />
      <h1>Sign In</h1>
      {/* check to see if the action is still loading or has an error  */}
      {error && <Message variant="danger">{error}</Message>}
      {loading && <BunnyLoader />}
      <Form onSubmit={submitHandler}>
        {/* email */}
        <Form.Group controlId="email" className="mb-3">
          <Form.Label>Email Address</Form.Label>
          <Form.Control
            type="email"
            placeholder="Enter email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          ></Form.Control>
        </Form.Group>

        {/* password */}
        <Form.Group controlId="password" className="mb-3">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          ></Form.Control>
        </Form.Group>

        {/* button */}
        <Button type="submit" variant="secondary">
          Sign In
        </Button>
      </Form>
      <div className="form-screen__footer">
        New Shopper?{" "}
        <Link
          to={
            redirect !== "/"
              ? `/register?redirect=${encodeURIComponent(redirect)}`
              : "/register"
          }
        >
          Register
        </Link>
      </div>
    </FormContainer>
  );
};

export default LoginScreen;
