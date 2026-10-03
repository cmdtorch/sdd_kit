from django.db import models


class Sale(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft"
        PAID = "paid"
        CANCELLED = "cancelled"

    student = models.ForeignKey("students.Student", on_delete=models.PROTECT, related_name="sales")
    service = models.ForeignKey("products.Service", on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT)

    @property
    def total(self):
        return self.quantity * self.unit_price
