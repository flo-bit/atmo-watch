import { redirect, type RequestHandler } from '@sveltejs/kit';

// Previously shared links point here. The image itself is now a JPEG.
export const GET: RequestHandler = ({ url }) => {
	redirect(308, url.pathname.replace(/\.png$/, '.jpg'));
};
