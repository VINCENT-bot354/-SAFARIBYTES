import os
import json
import requests
import logging
from utils import normalize_phone_number

logger = logging.getLogger(__name__)


class PaymentService:

    def __init__(self):
        self.endpoint = os.getenv('PAYHERO_STK_PUSH_ENDPOINT')
        self.auth_token = os.getenv('PAYHERO_BASIC_AUTH_TOKEN')
        self.channel_id = os.getenv('PAYHERO_CHANNEL_ID')
        self.provider = os.getenv('PAYHERO_PROVIDER', 'm-pesa')
        self.website_url = os.getenv('WEBSITE_URL')
        self.callback_path = os.getenv('PAYHERO_CALLBACK_PATH', '/api/callbacks/payhero/stk')

        logger.info("=" * 80)
        logger.info("PaymentService initialized")
        logger.info(f"Endpoint: {self.endpoint}")
        logger.info(f"Channel ID: {self.channel_id}")
        logger.info(f"Provider: {self.provider}")
        logger.info(f"Website URL: {self.website_url}")
        logger.info(f"Callback Path: {self.callback_path}")
        logger.info(f"Auth Token Configured: {bool(self.auth_token)}")
        logger.info("=" * 80)

    def initiate_stk_push(self, phone_number, amount, reference):
        """
        Initiate M-Pesa STK Push via PayHero

        Args:
            phone_number: Customer phone (will be normalized to 254XXXXXXXXX)
            amount: Amount in KES (integer)
            reference: Unique order reference

        Returns:
            (success: bool, response_data: dict, message: str)
        """
        logger.info("=" * 80)
        logger.info(f"STK PUSH REQUEST - Reference: {reference}")
        logger.info(f"Input Phone: {phone_number}")
        logger.info(f"Amount: {amount}")

        normalized_phone = normalize_phone_number(phone_number)
        logger.info(f"Normalized Phone: {normalized_phone}")

        if not normalized_phone:
            logger.error(f"Phone normalization failed for: {phone_number}")
            return False, {}, "Invalid phone number format"

        if not self.endpoint or not self.auth_token:
            logger.error("PayHero credentials not configured")
            logger.error(f"Endpoint: {self.endpoint}")
            logger.error(f"Auth Token Present: {bool(self.auth_token)}")
            return False, {}, "PayHero credentials not configured"

        callback_url = f"{self.website_url}{self.callback_path}"
        logger.info(f"Full Callback URL: {callback_url}")

        # Validate callback URL
        if not callback_url.startswith('https://'):
            logger.warning(f"Callback URL should use HTTPS for production: {callback_url}")

        if 'replit.dev' in callback_url:
            logger.warning("Using Replit dev URL - ensure this URL is accessible from PayHero's servers")

        payload = {
            "provider": self.provider,
            "phone_number": normalized_phone,
            "amount": int(amount),
            "external_reference": reference,  # <-- PayHero expects this key
            "channel_id": self.channel_id,
            "callback_url": callback_url
        }

        headers = {
            "Authorization": f"Basic {self.auth_token}",
            "Content-Type": "application/json"
        }

        logger.info(f"PayHero Payload: {json.dumps(payload, indent=2)}")
        logger.info(f"PayHero Headers: Authorization=Basic [REDACTED], Content-Type={headers['Content-Type']}")

        try:
            logger.info(f"Sending POST request to: {self.endpoint}")
            response = requests.post(self.endpoint, json=payload, headers=headers, timeout=30)

            logger.info(f"PayHero Response Status: {response.status_code}")
            logger.info(f"PayHero Response Body: {response.text}")

            if response.status_code in [200, 201]:
                response_data = response.json()
                logger.info(f"STK Push SUCCESS - Response: {json.dumps(response_data, indent=2)}")
                return True, response_data, "STK Push initiated successfully"
            else:
                response_data = response.json() if response.text else {}
                logger.error(f"STK Push FAILED - Status: {response.status_code}")
                logger.error(f"Error Response: {json.dumps(response_data, indent=2)}")
                return False, response_data, f"PayHero returned status {response.status_code}"

        except requests.RequestException as e:
            logger.exception(f"STK Push REQUEST EXCEPTION: {str(e)}")
            return False, {}, f"Failed to contact PayHero: {str(e)}"
        finally:
            logger.info("=" * 80)

    def verify_callback(self, callback_data):
        """
        Verify and process PayHero callback data

        Returns:
            (success: bool, reference: str, message: str)
        """
        logger.info("=" * 80)
        logger.info(f"Verifying callback data: {json.dumps(callback_data, indent=2)}")

        try:
            # PayHero sometimes wraps response in 'response' or 'data'
            data_obj = callback_data.get("response") or callback_data.get("data") or callback_data

            # Extract both our external reference and PayHero's internal reference
            external_reference = (
                data_obj.get("ExternalReference")
                or data_obj.get("external_reference")
                or data_obj.get("order_reference")
            )

            payhero_reference = data_obj.get("reference")

            # Extract transaction status
            status = (
                data_obj.get("Status")
                or data_obj.get("status")
                or data_obj.get("payment_status")
            )

            phone_number = data_obj.get("phone_number")
            amount = data_obj.get("amount")

            logger.info(f"Extracted external_reference: {external_reference}")
            logger.info(f"Extracted payhero_reference: {payhero_reference}")
            logger.info(f"Extracted status: {status}")

            success_statuses = ["success", "completed", "successful", "paid", "complete"]
            failure_statuses = ["failed", "cancelled", "canceled", "declined", "rejected"]

            status_str = str(status).lower() if status else ""

            if status_str in success_statuses:
                logger.info("Payment marked as SUCCESS")
                return True, external_reference, "Payment successful"
            elif status_str in failure_statuses:
                logger.info("Payment marked as FAILED")
                return False, external_reference, f"Payment failed: {status}"
            else:
                logger.warning(f"Unknown payment status: {status}")
                return False, external_reference, f"Unknown status: {status}"

        except Exception as e:
            logger.exception(f"Callback verification exception: {str(e)}")
            return False, None, f"Invalid callback data: {str(e)}"
        finally:
            logger.info("=" * 80)
