// Temporary preview route for the redesign Proposal Feed (screen 05).
// Reachable at /redesign-feed so the new design can be tested on-device before
// the tab-by-tab IA cutover. Remove once the redesign replaces the live tabs.
import { FeedScreen } from '../components/redesign/screens/FeedScreen';

export default function RedesignFeedRoute() {
  return <FeedScreen />;
}
