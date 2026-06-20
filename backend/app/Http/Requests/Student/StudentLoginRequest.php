<?php

namespace App\Http\Requests\Student;

use Illuminate\Foundation\Http\FormRequest;

class StudentLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'matric_number' => ['required', 'string', 'max:50'],
            'exam_code'     => ['required', 'string', 'max:12'],
        ];
    }
}
